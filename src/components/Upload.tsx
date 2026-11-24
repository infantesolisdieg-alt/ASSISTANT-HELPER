// Pantalla Upload: agregar archivos (computadora, arrastrar, pegar o Google Drive), revisar nombre,
// grupo y título de cada uno, y analizarlos.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { driveEnabled, type PickedFile } from '../cloud/drive';
import { ACCEPTED_EXTENSIONS, MAX_FILE_MB, extractFile, fileKind, needsSourceUrl } from '../extract';
import { paragraphRanges } from '../extract/types';
import { APP_NAME, t, tn } from '../i18n';
import { tRich } from '../i18n/rich';
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
      patch: { state: 'error', progress: undefined, error: err instanceof Error ? err.message : t('The file could not be read.') },
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
              ? t('No readable text was found, even with text recognition.')
              : t('The file does not contain any text.'),
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
    progress: { label: t('Waiting…'), value: 0 },
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
      if (!fileKind(f.name)) problems.push(t('{name}: only Word, PDF, text and image files are supported.', { name: f.name }));
      else if (f.size > MAX_FILE_MB * 1024 * 1024) problems.push(t('{name}: the file is larger than {mb} MB.', { name: f.name, mb: MAX_FILE_MB }));
      else if (isDuplicate(f.name, f.size) || good.some((g) => g.name === f.name && g.size === f.size))
        problems.push(t('{name}: this file is already loaded.', { name: f.name }));
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
    setDriveStatus(t('Opening Google Drive…'));
    try {
      const drive = await import('../cloud/drive');
      const { picked, token } = await drive.chooseFromDrive(state.profile?.email);
      const problems: string[] = [];
      const good: { f: PickedFile; item: DocItem }[] = [];
      for (const f of picked) {
        const why = drive.driveProblem(f);
        const name = drive.downloadName(f);
        if (why) problems.push(why);
        else if (isDuplicate(name, f.sizeBytes)) problems.push(t('{name}: this file is already loaded.', { name }));
        else good.push({ f, item: newItem(name, f.sizeBytes, 'drive') });
      }
      setRejected(problems);
      if (!good.length) return;
      // Las filas aparecen enseguida y cada una muestra su descarga y su lectura
      addRows(good.map((g) => ({ ...g.item, progress: { label: t('Waiting to download…'), value: 0 } })));
      notify(tn(good.length, '{n} file added from Google Drive.', '{n} files added from Google Drive.'));
      good.forEach(({ f, item }) =>
        limit(async () => {
          if (!alive(item.id)) return;
          const report = progressFor(item.id, 0, 0.4);
          report(t('Downloading from Google Drive…'), 0);
          const file = await drive.downloadDriveFile(f, token, (p) =>
            report(t('Downloading from Google Drive ({p}%)…', { p: Math.round(p * 100) }), p),
          );
          await readInto(item, file, 0.4);
        }).catch((err) => fail(item.id, err)),
      );
    } catch (e) {
      const { DriveCancelled } = await import('../cloud/drive');
      if (!(e instanceof DriveCancelled)) setRejected([e instanceof Error ? e.message : t('Google Drive could not be opened.')]);
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
  if (!staged.length) reason = t('Add files to start.');
  else if (readingCount) reason = tn(readingCount, 'Waiting for {n} file to finish…', 'Waiting for {n} files to finish…');
  else if (!ready.length) reason = t('None of the files could be read.');
  else if (missingName.length) reason = tn(missingName.length, 'Enter the student name for {n} file.', 'Enter the student name for {n} files.');
  else if (!hasSubmission) reason = t('Add at least one student submission (not only reference files).');

  const focusFirstMissing = () => {
    const el = document.querySelector<HTMLInputElement>('.upload-table input.input-invalid');
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const applyGroupToAll = () => {
    const g = cleanGroup(bulkGroup);
    const targets = staged.filter((d) => !d.isReference);
    targets.forEach((d) => dispatch({ type: 'updateDoc', id: d.id, patch: { group: g } }));
    notify(g ? tn(targets.length, 'Group “{group}” applied to {n} file.', 'Group “{group}” applied to {n} files.', { group: g }) : t('Group removed from all files.'));
  };

  const analyze = () => {
    const subs = ready.filter((d) => !d.isReference).length;
    const refs = ready.length - subs;
    // Quita los archivos que no se pudieron leer
    failed.forEach((d) => dispatch({ type: 'removeDoc', id: d.id }));
    dispatch({ type: 'analyzeStaged' });
    notify(
      t('Analysis complete: {items}.', {
        items:
          tn(subs, '{n} submission', '{n} submissions') +
          (refs ? ' ' + tn(refs, 'and {n} reference file', 'and {n} reference files') : '') +
          (failed.length ? ' ' + tn(failed.length, '({n} unreadable file skipped)', '({n} unreadable files skipped)') : ''),
      }),
    );
    go('dashboard');
  };

  const openPicker = () => inputRef.current?.click();
  // Celular o tableta: no se puede arrastrar ni pegar con Ctrl+V, se toca para elegir
  const touch = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches, []);

  return (
    <div className="page upload-page">
      <section className="card upload-hero">
        <div className="upload-head">
          <div>
            <h2>{t('Add submissions')}</h2>
            <p className="muted-text">
              {t('Files are read in your browser.')}{' '}
              {state.profile?.uid
                ? t('When you press Analyze, the text and results are saved to your Google account (the original files are not uploaded).')
                : t('Nothing is sent to a server.')}
            </p>
          </div>
        </div>

        <div className="upload-grid">
          <div
            className={`dropzone dropzone-large${dragging ? ' dragging' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={t('Add files: drop them here or press Enter to choose files from this computer')}
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
            <p className="dropzone-title">
              {touch ? t('Tap to choose files') : dragging ? t('Drop the files to add them') : t('Drag and drop files here')}
            </p>
            <p className="muted-text small" hidden={touch}>
              {tRich('or {browse} · {keys} to paste', {
                browse: <span className="link-like">{t('click to browse')}</span>,
                keys: (
                  <>
                    <kbd>Ctrl</kbd> + <kbd>V</kbd>
                  </>
                ),
              })}
            </p>
            <ul className="format-chips" aria-label={t('Accepted formats')}>
              {['DOCX', 'PDF', 'TXT', 'PNG', 'JPG', 'WEBP'].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="small muted-text">{t('Up to {mb} MB per file · scanned PDFs and images are read with OCR', { mb: MAX_FILE_MB })}</p>
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
              title={touch ? t('This device') : t('This computer')}
              text={touch ? t('Word, PDF, text or image files saved on this device.') : t('Word, PDF, text or image files saved on this computer.')}
              action={
                <button type="button" className="button button-primary" onClick={openPicker}>
                  {t('Choose files')}
                </button>
              }
            />
            {driveEnabled && (
              <SourceCard
                icon={<DriveLogo size={24} />}
                title="Google Drive"
                text={t('My Drive, files shared with you and shared drives. Google Docs become Word files.')}
                action={
                  <button type="button" className="button button-secondary drive-button" onClick={fromDrive} disabled={driveBusy}>
                    {driveBusy ? <span className="spinner" aria-hidden="true" /> : <DriveLogo size={16} />}
                    {driveBusy ? driveStatus || t('Waiting for Google Drive…') : t('Choose from Drive')}
                  </button>
                }
                note={
                  <>
                    {t('{app} can only open the files you choose.', { app: APP_NAME })}{' '}
                    <button type="button" className="inline-link" onClick={() => setShowTerms(true)}>
                      {t('How Drive data is used')}
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
              <strong>{tn(rejected.length, '{n} file was not added.', '{n} files were not added.')}</strong>
              <ul className="alert-list">
                {rejected.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <button type="button" className="icon-button alert-close" aria-label={t('Dismiss message')} onClick={() => setRejected([])}>
              ×
            </button>
          </div>
        )}
      </section>

      <section className="card files-card">
        <div className="card-header">
          <div>
            <h2>
              {t('Files to analyze')} {staged.length > 0 && <span className="count-pill">{staged.length}</span>}
            </h2>
            <p className="muted-text small">
              {tRich('Check the student name, group and assignment title. Mark source texts as {reference} to compare against them.', {
                reference: <strong>{t('Reference')}</strong>,
              })}
            </p>
          </div>
          {staged.length > 0 && (
            <div className="status-chips" aria-label={t('File status')}>
              <span className="status-chip chip-ok">
                <Icon name="check" size={14} /> {t('{n} ready', { n: ready.length })}
              </span>
              {readingCount > 0 && (
                <span className="status-chip chip-neutral">
                  <span className="spinner" aria-hidden="true" /> {t('{n} in progress', { n: readingCount })}
                </span>
              )}
              {failed.length > 0 && (
                <span className="status-chip chip-bad">
                  <Icon name="alert" size={14} /> {t('{n} failed', { n: failed.length })}
                  <button
                    type="button"
                    className="button button-link chip-action"
                    onClick={() => failed.forEach((d) => dispatch({ type: 'removeDoc', id: d.id }))}
                  >
                    {t('Remove')}
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {staged.length > 0 && (
          <div className="list-toolbar">
            <SearchBox
              id="upload-search"
              value={query}
              onChange={setQuery}
              label={t('Search files')}
              placeholder={t('Search by file, student or group…')}
            />
            <div className="bulk-group">
              <label className="field-label" htmlFor="bulk-group">
                {t('Group for all files')}
              </label>
              <div className="inline-fields">
                <input
                  id="bulk-group"
                  className="input"
                  list="group-options"
                  value={bulkGroup}
                  placeholder={t('e.g. 5A')}
                  onChange={(e) => setBulkGroup(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyGroupToAll()}
                />
                <button type="button" className="button button-secondary" onClick={applyGroupToAll}>
                  {t('Apply to all')}
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
            <p className="strong">{t('No files yet')}</p>
            <p className="muted-text small">
              {driveEnabled
                ? t('Add student work from this computer or Google Drive. Each file appears here so you can check its details before analyzing.')
                : t('Add student work from this computer. Each file appears here so you can check its details before analyzing.')}
              {submissions.length > 0 &&
                ' ' + tn(submissions.length, '{n} submission is already analyzed in this session.', '{n} submissions are already analyzed in this session.')}
            </p>
          </div>
        ) : (
          <div>
            <table className="table upload-table">
              <thead>
                <tr>
                  <th scope="col">{t('File')}</th>
                  <th scope="col">{t('Student name')}</th>
                  <th scope="col">{t('Group')}</th>
                  <th scope="col">{t('Assignment title')}</th>
                  <th scope="col">{t('Reference')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-inline">
                      {t('No files match “{q}”.', { q: query })}
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
                            <span className="file-source" title={t('From Google Drive')}>
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
                                <span>{d.progress?.label ?? t('Reading…')}</span>
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
                                <Icon name="check" size={14} /> {t('Ready')} · {t('{n} words', { n: d.text.split(/\s+/).filter(Boolean).length })}
                                {d.pages && d.kind === 'pdf' ? ` · ${tn(d.pages.length, '{n} page', '{n} pages')}` : ''}
                                {d.tables?.length ? ` · ${tn(d.tables.length, '{n} table', '{n} tables')}` : ''}
                                {d.figures?.length ? ` · ${tn(d.figures.length, '{n} figure', '{n} figures')}` : ''}
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
                        aria-label={t('Student name for {file}', { file: d.fileName })}
                        placeholder={d.isReference ? t('Not needed') : t('Name')}
                        value={d.studentName}
                        disabled={d.isReference || d.state === 'error'}
                        onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { studentName: e.target.value } })}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-group"
                        list="group-options"
                        aria-label={t('Group for {name}', { name: d.fileName })}
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
                        aria-label={t('Assignment title for {file}', { file: d.fileName })}
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
                          aria-label={t('Mark {file} as a reference file', { file: d.fileName })}
                          disabled={d.state === 'error'}
                          onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { isReference: e.target.checked } })}
                        />
                        <span className="ref-text">{t('Reference')}</span>
                      </label>
                    </td>
                    <td className="right">
                      <button
                        type="button"
                        className="icon-button row-remove"
                        aria-label={t('Remove {file}', { file: d.fileName })}
                        title={t('Remove')}
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
                <Icon name="check" size={16} /> {tn(ready.length, '{n} file ready to analyze', '{n} files ready to analyze')}
                {failed.length > 0 && ` · ${tn(failed.length, '{n} unreadable file will be skipped', '{n} unreadable files will be skipped')}`}
              </>
            ) : (
              <>
                {readingCount > 0 && <span className="spinner" aria-hidden="true" />}
                {reason}
                {missingName.length > 0 && readingCount === 0 && (
                  <button type="button" className="button button-link" onClick={focusFirstMissing}>
                    {t('Show')}
                  </button>
                )}
              </>
            )}
          </p>
          <button type="button" className="button button-primary button-lg" disabled={!canAnalyze} onClick={analyze}>
            {ready.length ? tn(ready.length, 'Analyze {n} file', 'Analyze {n} files') : t('Analyze')} <Icon name="arrow" size={18} />
          </button>
        </div>
      </section>

      {showTerms && <TermsDialog section="drive" onClose={() => setShowTerms(false)} />}

      {analyzedRefs.length > 0 && (
        <section className="card">
          <h2>{t('Reference files in this session')}</h2>
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
