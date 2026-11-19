import { useRef, useState } from 'react';
import { ACCEPTED_EXTENSIONS, ACCEPTED_LABEL, MAX_FILE_MB, extractFile, fileKind, needsSourceUrl } from '../extract';
import { paragraphRanges } from '../extract/types';
import { newId, useStore } from '../state/store';
import type { DocItem } from '../types';
import { Icon } from './icons';

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}

export function Upload() {
  const { state, dispatch, submissions, go, notify, hasDoc } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const staged = state.docs.filter((d) => !d.analyzed);
  const analyzedRefs = state.docs.filter((d) => d.analyzed && d.isReference);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const problems: string[] = [];
    const good: File[] = [];
    for (const f of list) {
      if (!fileKind(f.name)) problems.push(`${f.name}: only ${ACCEPTED_LABEL} are supported.`);
      else if (f.size > MAX_FILE_MB * 1024 * 1024) problems.push(`${f.name}: the file is larger than ${MAX_FILE_MB} MB.`);
      else if (state.docs.some((d) => d.fileName === f.name && d.fileSize === f.size) || good.some((g) => g.name === f.name && g.size === f.size))
        problems.push(`${f.name}: this file is already loaded.`);
      else good.push(f);
    }
    setRejected(problems);

    const items: DocItem[] = good.map((f) => {
      const kind = fileKind(f.name)!;
      return {
        id: newId(),
        fileName: f.name,
        fileSize: f.size,
        kind,
        studentName: '',
        assignmentTitle: baseName(f.name),
        isReference: false,
        text: '',
        sourceUrl: needsSourceUrl(kind) ? URL.createObjectURL(f) : undefined,
        state: 'reading',
        progress: { label: 'Waiting…', value: 0 },
        analyzed: false,
        reviewStatus: 'pending',
        finalComment: '',
        notes: [],
      };
    });
    if (items.length) dispatch({ type: 'addDocs', docs: items });

    items.forEach((item, i) => {
      let last = 0;
      const onProgress = (label: string, value: number) => {
        const now = performance.now();
        if (now - last < 120 && value < 1) return; // no saturar la interfaz
        last = now;
        dispatch({ type: 'updateDoc', id: item.id, patch: { progress: { label, value } } });
      };
      extractFile(good[i], item.sourceUrl, onProgress)
        .then((res) => {
          if (!hasDoc(item.id)) {
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
        })
        .catch((err: unknown) => {
          dispatch({
            type: 'updateDoc',
            id: item.id,
            patch: { state: 'error', progress: undefined, error: err instanceof Error ? err.message : 'The file could not be read.' },
          });
        });
    });
  };

  const ready = staged.filter((d) => d.state === 'ready');
  const reading = staged.some((d) => d.state === 'reading');
  const missingName = ready.filter((d) => !d.isReference && !d.studentName.trim());
  const hasSubmission = ready.some((d) => !d.isReference) || submissions.length > 0;
  const canAnalyze = ready.length > 0 && !reading && missingName.length === 0 && hasSubmission;

  const analyze = () => {
    const subs = ready.filter((d) => !d.isReference).length;
    const refs = ready.length - subs;
    // Quita los archivos que no se pudieron leer
    staged.filter((d) => d.state === 'error').forEach((d) => dispatch({ type: 'removeDoc', id: d.id }));
    dispatch({ type: 'analyzeStaged' });
    notify(
      `Analysis complete: ${subs} submission${subs === 1 ? '' : 's'}${refs ? ` and ${refs} reference file${refs === 1 ? '' : 's'}` : ''}.`,
    );
    go('dashboard');
  };

  return (
    <div className="page">
      <section className="card">
        <h2>Upload submissions</h2>
        <p className="muted-text">
          Accepted formats: {ACCEPTED_LABEL}. Files are read in your browser and are never sent to a server. Scanned PDFs and images are read with text recognition (OCR). Mark source
          texts you want to compare against as <strong>Reference files</strong>.
        </p>

        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <span className="dropzone-icon">
            <Icon name="upload" size={28} />
          </span>
          <p className="dropzone-title">Drag and drop files here</p>
          <p className="muted-text">or</p>
          <button type="button" className="button button-primary" onClick={() => inputRef.current?.click()}>
            Select files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {rejected.length > 0 && (
          <div className="alert alert-bad" role="alert">
            <strong>
              {rejected.length} file{rejected.length === 1 ? ' was' : 's were'} not added.
            </strong>
            <ul className="alert-list">
              {rejected.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Files to analyze</h2>
            <p className="muted-text small">
              Check the student name and assignment title for each file. Reference files are used only for comparison.
            </p>
          </div>
          <button type="button" className="button button-primary" disabled={!canAnalyze} onClick={analyze}>
            Analyze
          </button>
        </div>

        {staged.length === 0 ? (
          <p className="empty-inline">
            No files waiting. {submissions.length > 0 && `${submissions.length} submission(s) already analyzed in this session.`}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Student name</th>
                <th scope="col">Assignment title</th>
                <th scope="col">Reference file</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {staged.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="file-cell">
                      {d.kind === 'image' && d.sourceUrl ? (
                        <img className="file-thumb" src={d.sourceUrl} alt="" />
                      ) : (
                        <span className={`file-badge file-${d.kind}`} aria-hidden="true">
                          {d.kind === 'image' ? 'IMG' : d.kind.toUpperCase()}
                        </span>
                      )}
                      <div className="file-info">
                        <div className="strong file-name">{d.fileName}</div>
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
                      placeholder={d.isReference ? 'Not needed' : 'Student name'}
                      value={d.studentName}
                      disabled={d.isReference || d.state === 'error'}
                      onChange={(e) => dispatch({ type: 'updateDoc', id: d.id, patch: { studentName: e.target.value } })}
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
                      Reference
                    </label>
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="button button-link"
                      aria-label={`Remove ${d.fileName}`}
                      onClick={() => dispatch({ type: 'removeDoc', id: d.id })}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {missingName.length > 0 && (
          <p className="form-hint text-bad">Enter a student name for every submission before analyzing.</p>
        )}
        {ready.length > 0 && !hasSubmission && (
          <p className="form-hint text-bad">Add at least one student submission (not only reference files).</p>
        )}
      </section>

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
