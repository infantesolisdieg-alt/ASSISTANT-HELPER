// Pantalla Upload: agregar archivos (computadora, arrastrar, pegar o Google Drive), revisar nombre,
// grupo y título de cada uno, y analizarlos.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { driveEnabled, type PickedFile } from '../cloud/drive';
import { ACCEPTED_EXTENSIONS, MAX_FILE_MB, extractFile, fileKind, needsSourceUrl } from '../extract';
import { paragraphRanges } from '../extract/types';
import { newId, useStore } from '../state/store';
import { cleanGroup, groupsOf, type DocItem } from '../types';
import { Icon } from './icons';
import { TermsDialog } from './Terms';
import { matchesSearch, SearchBox } from './SearchBox';

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}

/* ---------- Cola: como máximo 3 archivos se leen o descargan a la vez ---------- */
const MAX_PARALLEL = 3;
let running = 0;
const waiting: (() => void)[] = [];
function limit<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          waiting.shift()?.();
        });
    };
    if (running < MAX_PARALLEL) run();
    else waiting.push(run);
  });
}

function DriveLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 78) / 87.3} viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function SourceCard({
  icon,
  title,
  text,
  action,
  note,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="source-card">
      <span className="source-icon">{icon}</span>
      <div className="source-body">
        <h3>{title}</h3>
        <p>{text}</p>
        {action}
        {note && <p className="source-note">{note}</p>}
      </div>
    </div>
  );
}

export function Upload() {
  const { state, dispatch, submissions, go, notify, hasDoc } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Contador de dragenter/dragleave: evita el parpadeo al pasar sobre el texto y los botones
  const dragDepth = useRef(0);
  const [rejected, setRejected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  // Grupo que se asigna a los archivos nuevos (por defecto, el del perfil)
  const [bulkGroup, setBulkGroup] = useState(state.profile?.group ?? '');
  const [driveStatus, setDriveStatus] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const docsRef = useRef(state.docs);
  docsRef.current = state.docs;
  // Filas recién agregadas que React todavía no dibuja: hasDoc aún no las conoce, pero siguen vivas
  const fresh = useRef(new Set<string>());
  useEffect(() => {
    for (const d of state.docs) fresh.current.delete(d.id);
  }, [state.docs]);
  const alive = (id: string) => fresh.current.has(id) || hasDoc(id);
  const addRows = (docs: DocItem[]) => {
    docs.forEach((d) => fresh.current.add(d.id));
    dispatch({ type: 'addDocs', docs });
  };

  const staged = state.docs.filter((d) => !d.analyzed);
  const knownGroups = useMemo(() => groupsOf(state.docs), [state.docs]);
  const visible = staged.filter((d) => matchesSearch(query, [d.fileName, d.studentName, d.group, d.assignmentTitle]));
  const analyzedRefs = state.docs.filter((d) => d.analyzed && d.isReference);

  // Se precargan los scripts de Google para que la ventana de permiso abra al instante (si no, el navegador la bloquea)
  useEffect(() => {
    if (driveEnabled) import('../cloud/drive').then((m) => m.preloadDrive()).catch(() => undefined);
  }, []);

  /* ---------- Lectura de un archivo ya disponible en el navegador ---------- */
  const progressFor = (id: string, offset = 0, scale = 1) => {
    let last = 0;
    return (label: string, value: number) => {
      const now = performance.now();
      if (now - last < 120 && value < 1) return; // no saturar la interfaz
      last = now;
      dispatch({ type: 'updateDoc', id, patch: { progress: { label, value: offset + value * scale } } });
    };
  };

  const fail = (id: string, err: unknown) =>
    dispatch({
      type: 'updateDoc',
      id,
      patch: { state: 'error', progress: undefined, error: err instanceof Error ? err.message : 'The file could not be read.' },
    });

  const readInto = async (item: DocItem, file: File, offset = 0) => {
    if (!alive(item.id)) return;
    let sourceUrl = item.sourceUrl;
    if (!sourceUrl && needsSourceUrl(item.kind)) {
      sourceUrl = URL.createObjectURL(file);
      dispatch({ type: 'updateDoc', id: item.id, patch: { sourceUrl } });
    }
    const res = await extractFile(file, sourceUrl, progressFor(item.id, offset, 1 - offset));
    if (!alive(item.id)) {
      // La docente quitó el archivo mientras se leía: se liberan sus imágenes
      for (const f of res.figures ?? []) if (f.src) URL.revokeObjectURL(f.src);
      return;
    }
    const text = res.paragraphs.join('\n\n');
    if (!text.trim()) {
      dispatch({
        type: 'updateDoc',
        id: item.id,
        patch: {
          state: 'error',
          progress: undefined,
          error:
            item.kind === 'image' || item.kind === 'pdf'
              ? 'No readable text was found, even with text recognition.'
              : 'The file does not contain any text.',
        },
      });
      return;
    }
    dispatch({
      type: 'updateDoc',
      id: item.id,
      patch: {
        state: 'ready',
        progress: undefined,
        text,
        paraRanges: paragraphRanges(res.paragraphs),
        docxFormat: res.docxFormat,
        pages: res.pages,
        blocks: res.blocks,
        tables: res.tables,
        figures: res.figures,
        ocrConfidence: res.ocrConfidence,
        skippedPages: res.skippedPages,
      },
    });
  };

  const newItem = (name: string, size: number, source: DocItem['source'], sourceUrl?: string): DocItem => ({
    id: newId(),
    fileName: name,
    fileSize: size,
    source,
    kind: fileKind(name)!,
    studentName: '',
    group: cleanGroup(bulkGroup),
    assignmentTitle: baseName(name),
    isReference: false,
    text: '',
    sourceUrl,
    state: 'reading',
    progress: { label: 'Waiting…', value: 0 },
    analyzed: false,
    reviewStatus: 'pending',
    finalComment: '',
    notes: [],
  });

  const isDuplicate = (name: string, size: number) =>
    docsRef.current.some((d) => d.fileName === name && (!size || !d.fileSize || d.fileSize === size));

  /* ---------- Desde la computadora (botón, arrastrar o pegar) ---------- */
  const addFiles = (files: FileList | File[]) => {
    const problems: string[] = [];
    const good: File[] = [];
    for (const f of Array.from(files)) {
      if (!fileKind(f.name)) problems.push(`${f.name}: only Word, PDF, text and image files are supported.`);
      else if (f.size > MAX_FILE_MB * 1024 * 1024) problems.push(`${f.name}: the file is larger than ${MAX_FILE_MB} MB.`);
      else if (isDuplicate(f.name, f.size) || good.some((g) => g.name === f.name && g.size === f.size))
        problems.push(`${f.name}: this file is already loaded.`);
      else good.push(f);
    }
    setRejected(problems);
    const items = good.map((f) => newItem(f.name, f.size, 'computer', needsSourceUrl(fileKind(f.name)!) ? URL.createObjectURL(f) : undefined));
    if (!items.length) return;
    addRows(items);
    items.forEach((item, i) => limit(() => readInto(item, good[i])).catch((err) => fail(item.id, err)));
  };

  /* ---------- Desde Google Drive ---------- */
  const fromDrive = async () => {
    setDriveBusy(true);
    setDriveStatus('Opening Google Drive…');
    try {
      const drive = await import('../cloud/drive');
      const { picked, token } = await drive.chooseFromDrive(state.profile?.email);
      const problems: string[] = [];
      const good: { f: PickedFile; item: DocItem }[] = [];
      for (const f of picked) {
        const why = drive.driveProblem(f);
        const name = drive.downloadName(f);
        if (why) problems.push(why);
        else if (isDuplicate(name, f.sizeBytes)) problems.push(`${name}: this file is already loaded.`);
        else good.push({ f, item: newItem(name, f.sizeBytes, 'drive') });
      }
      setRejected(problems);
      if (!good.length) return;
      // Las filas aparecen enseguida y cada una muestra su descarga y su lectura
      addRows(good.map((g) => ({ ...g.item, progress: { label: 'Waiting to download…', value: 0 } })));
      notify(`${good.length} file${good.length === 1 ? '' : 's'} added from Google Drive.`);
      good.forEach(({ f, item }) =>
        limit(async () => {
          if (!alive(item.id)) return;
          const report = progressFor(item.id, 0, 0.4);
          report('Downloading from Google Drive…', 0);
          const file = await drive.downloadDriveFile(f, token, (p) =>
            report(`Downloading from Google Drive (${Math.round(p * 100)}%)…`, p),
          );
          await readInto(item, file, 0.4);
        }).catch((err) => fail(item.id, err)),
      );
    } catch (e) {
      const { DriveCancelled } = await import('../cloud/drive');
      if (!(e instanceof DriveCancelled)) setRejected([e instanceof Error ? e.message : 'Google Drive could not be opened.']);
    } finally {
      setDriveBusy(false);
      setDriveStatus('');
    }
  };

  /* ---------- Pegar archivos con Ctrl+V ---------- */
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length) {
        e.preventDefault();
        addFilesRef.current(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  /* ---------- Estado de la lista y botón Analyze ---------- */
  const ready = staged.filter((d) => d.state === 'ready');
  const readingCount = staged.filter((d) => d.state === 'reading').length;
  const failed = staged.filter((d) => d.state === 'error');
  const missingName = ready.filter((d) => !d.isReference && !d.studentName.trim());
  const hasSubmission = ready.some((d) => !d.isReference) || submissions.length > 0;
  const canAnalyze = ready.length > 0 && readingCount === 0 && missingName.length === 0 && hasSubmission;

  let reason = '';
  if (!staged.length) reason = 'Add files to start.';
  else if (readingCount) reason = `Waiting for ${readingCount} file${readingCount === 1 ? '' : 's'} to finish…`;
  else if (!ready.length) reason = 'None of the files could be read.';
  else if (missingName.length) reason = `Enter the student name for ${missingName.length} file${missingName.length === 1 ? '' : 's'}.`;
  else if (!hasSubmission) reason = 'Add at least one student submission (not only reference files).';

  const focusFirstMissing = () => {
    const el = document.querySelector<HTMLInputElement>('.upload-table input.input-invalid');
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const applyGroupToAll = () => {
    const g = cleanGroup(bulkGroup);
    const targets = staged.filter((d) => !d.isReference);
    targets.forEach((d) => dispatch({ type: 'updateDoc', id: d.id, patch: { group: g } }));
    notify(g ? `Group “${g}” applied to ${targets.length} file(s).` : 'Group removed from all files.');
  };

  const analyze = () => {
    const subs = ready.filter((d) => !d.isReference).length;
    const refs = ready.length - subs;
    // Quita los archivos que no se pudieron leer
    failed.forEach((d) => dispatch({ type: 'removeDoc', id: d.id }));
    dispatch({ type: 'analyzeStaged' });
    notify(
      `Analysis complete: ${subs} submission${subs === 1 ? '' : 's'}${refs ? ` and ${refs} reference file${refs === 1 ? '' : 's'}` : ''}` +
        (failed.length ? ` (${failed.length} unreadable file${failed.length === 1 ? '' : 's'} skipped).` : '.'),
    );
    go('dashboard');
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="page upload-page">
      <section className="card upload-hero">
        <div className="upload-head">
          <div>
            <h2>Add submissions</h2>
            <p className="muted-text">
              Files are read in your browser.{' '}
              {state.profile?.uid
                ? 'When you press Analyze, the text and results are saved to your Google account (the original files are not uploaded).'
                : 'Nothing is sent to a server.'}
            </p>
          </div>
        </div>

        <div className="upload-grid">
          <div
            className={`dropzone dropzone-large${dragging ? ' dragging' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Add files: drop them here or press Enter to choose files from this computer"
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPicker();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <span className="dropzone-icon">
              <Icon name="upload" size={30} />
            </span>
            <p className="dropzone-title">{dragging ? 'Drop the files to add them' : 'Drag and drop files here'}</p>
            <p className="muted-text small">
              or <span className="link-like">click to browse</span> · <kbd>Ctrl</kbd> + <kbd>V</kbd> to paste
            </p>
            <ul className="format-chips" aria-label="Accepted formats">
              {['DOCX', 'PDF', 'TXT', 'PNG', 'JPG', 'WEBP'].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="small muted-text">Up to {MAX_FILE_MB} MB per file · scanned PDFs and images are read with OCR</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <div className="source-list">
            <SourceCard
              icon={<Icon name="upload" size={22} />}
              title="This computer"
              text="Word, PDF, text or image files saved on this computer."
              action={
                <button type="button" className="button button-primary" onClick={openPicker}>
                  Choose files
                </button>
              }
            />
            {driveEnabled && (
              <SourceCard
                icon={<DriveLogo size={24} />}
                title="Google Drive"
                text="My Drive, files shared with you and shared drives. Google Docs become Word files."
                action={
                  <button type="button" className="button button-secondary drive-button" onClick={fromDrive} disabled={driveBusy}>
                    {driveBusy ? <span className="spinner" aria-hidden="true" /> : <DriveLogo size={16} />}
                    {driveBusy ? driveStatus || 'Waiting for Google Drive…' : 'Choose from Drive'}
                  </button>
                }
                note={
                  <>
                    Assistant Helper can only open the files you choose.{' '}
                    <button type="button" className="inline-link" onClick={() => setShowTerms(true)}>
                      How Drive data is used
                    </button>
                  </>
                }
              />
            )}
          </div>
        </div>

        {rejected.length > 0 && (
          <div className="alert alert-bad alert-dismissible" role="alert">
            <div>
              <strong>
                {rejected.length} file{rejected.length === 1 ? ' was' : 's were'} not added.
              </strong>
              <ul className="alert-list">
                {rejected.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <button type="button" className="icon-button alert-close" aria-label="Dismiss message" onClick={() => setRejected([])}>
              ×
            </button>
          </div>
        )}
      </section>

      <section className="card files-card">
        <div className="card-header">
          <div>
            <h2>
              Files to analyze {staged.length > 0 && <span className="count-pill">{staged.length}</span>}
            </h2>
            <p className="muted-text small">
              Check the student name, group and assignment title. Mark source texts as <strong>Reference</strong> to compare
              against them.
            </p>
          </div>
          {staged.length > 0 && (
            <div className="status-chips" aria-label="File status">
              <span className="status-chip chip-ok">
                <Icon name="check" size={14} /> {ready.length} ready
              </span>
              {readingCount > 0 && (
                <span className="status-chip chip-neutral">
                  <span className="spinner" aria-hidden="true" /> {readingCount} in progress
                </span>
              )}
              {failed.length > 0 && (
                <span className="status-chip chip-bad">
                  <Icon name="alert" size={14} /> {failed.length} failed
                  <button
                    type="button"
                    className="button button-link chip-action"
                    onClick={() => failed.forEach((d) => dispatch({ type: 'removeDoc', id: d.id }))}
                  >
                    Remove
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {staged.length > 0 && (
          <div className="list-toolbar">
            <SearchBox id="upload-search" value={query} onChange={setQuery} label="Search files" placeholder="Search by file, student or group…" />
            <div className="bulk-group">
              <label className="field-label" htmlFor="bulk-group">
                Group for all files
              </label>
              <div className="inline-fields">
                <input
                  id="bulk-group"
                  className="input"
                  list="group-options"
                  value={bulkGroup}
                  placeholder="e.g. 5A"
                  onChange={(e) => setBulkGroup(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyGroupToAll()}
                />
                <button type="button" className="button button-secondary" onClick={applyGroupToAll}>
                  Apply to all
                </button>
              </div>
            </div>
          </div>
        )}
        <datalist id="group-options">
          {knownGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        {staged.length === 0 ? (
          <div className="files-empty">
            <span className="empty-icon">
              <Icon name="inbox" size={28} />
            </span>
            <p className="strong">No files yet</p>
            <p className="muted-text small">
              Add student work from this computer{driveEnabled ? ' or Google Drive' : ''}. Each file appears here so you can check
              its details before analyzing.
              {submissions.length > 0 && ` ${submissions.length} submission(s) are already analyzed in this session.`}
            </p>
          </div>
        ) : (
          <div>
            <table className="table upload-table">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Student name</th>
                  <th scope="col">Group</th>
                  <th scope="col">Assignment title</th>
                  <th scope="col">Reference</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-inline">
                      No files match “{query}”.
                    </td>
                  </tr>
                )}
                {visible.map((d) => (
                  <tr key={d.id} className={`upload-row row-${d.state}`}>
                    <td>
                      <div className="file-cell">
                        <span className="file-visual">
                          {d.kind === 'image' && d.sourceUrl ? (
                            <img className="file-thumb" src={d.sourceUrl} alt="" />
                          ) : (
                            <span className={`file-badge file-${d.kind}`} aria-hidden="true">
                              {d.kind === 'image' ? 'IMG' : d.kind.toUpperCase()}
                            </span>
                          )}
                          {d.source === 'drive' && (
                            <span className="file-source" title="From Google Drive">
                              <DriveLogo size={12} />
                            </span>
                          )}
                        </span>
                        <div className="file-info">
                          <div className="strong file-name" title={d.fileName}>
                            {d.fileName}
                          </div>
                          <div className="small file-status">
                            {d.state === 'reading' ? (
                              <span className="file-progress" role="status">
                                <span className="spinner" aria-hidden="true" />
                                <span>{d.progress?.label ?? 'Reading…'}</span>
                                <span className="progress-bar" aria-hidden="true">
                                  <span style={{ width: `${Math.round((d.progress?.value ?? 0) * 100)}%` }} />
                                </span>
                              </span>
                            ) : d.state === 'error' ? (
                              <span className="text-bad">
                                <Icon name="alert" size={14} /> {d.error}
                              </span>
                            ) : (
                              <span className="text-ok">
                                <Icon name="check" size={14} /> Ready · {d.text.split(/\s+/).filter(Boolean).length} words
                                {d.pages && d.kind === 'pdf' ? ` · ${d.pages.length} page${d.pages.length === 1 ? '' : 's'}` : ''}
                                {d.tables?.length ? ` · ${d.tables.length} table${d.tables.length === 1 ? '' : 's'}` : ''}
                                {d.figures?.length ? ` · ${d.figures.length} figure${d.figures.length === 1 ? '' : 's'}` : ''}
                                {d.pages?.some((p) => p.ocr) ? ' · OCR' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        className={`input${!d.isReference && d.state === 'ready' && !d.studentName.trim() ? ' input-invalid' : ''}`}
                        aria-label={`Student name for ${d.fileName}`}
                        placeholder={d.isReference ? 'Not needed' : 'Name'}
                        value={d.studentName}
                        disabled={d.isReference || d.state === 'error'}
                        onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { studentName: e.target.value } })}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-group"
                        list="group-options"
                        aria-label={`Group for ${d.fileName}`}
                        placeholder={d.isReference ? '—' : '5A'}
                        value={d.group}
                        disabled={d.isReference || d.state === 'error'}
                        onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { group: e.target.value } })}
                        onBlur={(e) => {
                          const g = cleanGroup(e.target.value);
                          if (g !== d.group) dispatch({ type: 'updateDoc', id: d.id, patch: { group: g } });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        aria-label={`Assignment title for ${d.fileName}`}
                        value={d.assignmentTitle}
                        disabled={d.state === 'error'}
                        onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { assignmentTitle: e.target.value } })}
                      />
                    </td>
                    <td>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={d.isReference}
                          aria-label={`Mark ${d.fileName} as a reference file`}
                          disabled={d.state === 'error'}
                          onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { isReference: e.target.checked } })}
                        />
                        <span className="ref-text">Reference</span>
                      </label>
                    </td>
                    <td className="right">
                      <button
                        type="button"
                        className="icon-button row-remove"
                        aria-label={`Remove ${d.fileName}`}
                        title="Remove"
                        onClick={() => dispatch({ type: 'removeDoc', id: d.id })}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={`analyze-bar${canAnalyze ? ' is-ready' : ''}`}>
          <p className="analyze-reason" role="status">
            {canAnalyze ? (
              <>
                <Icon name="check" size={16} /> {ready.length} file{ready.length === 1 ? '' : 's'} ready to analyze
                {failed.length > 0 && ` · ${failed.length} unreadable file${failed.length === 1 ? '' : 's'} will be skipped`}
              </>
            ) : (
              <>
                {readingCount > 0 && <span className="spinner" aria-hidden="true" />}
                {reason}
                {missingName.length > 0 && readingCount === 0 && (
                  <button type="button" className="button button-link" onClick={focusFirstMissing}>
                    Show
                  </button>
                )}
              </>
            )}
          </p>
          <button type="button" className="button button-primary button-lg" disabled={!canAnalyze} onClick={analyze}>
            Analyze{ready.length ? ` ${ready.length} file${ready.length === 1 ? '' : 's'}` : ''} <Icon name="arrow" size={18} />
          </button>
        </div>
      </section>

      {showTerms && <TermsDialog section="drive" onClose={() => setShowTerms(false)} />}

      {analyzedRefs.length > 0 && (
        <section className="card">
          <h2>Reference files in this session</h2>
          <ul className="plain-list">
            {analyzedRefs.map((r) => (
              <li key={r.id}>
                {r.assignmentTitle} <span className="muted-text small">({r.fileName})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
