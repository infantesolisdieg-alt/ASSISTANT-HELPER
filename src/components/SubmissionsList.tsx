// Lista "Submissions" del Dashboard: búsqueda, pestañas por grupo, secciones por grupo y orden.

import { useDeferredValue, useMemo, useState } from 'react';
import type { DocAnalysis } from '../analysis';
import { useStore } from '../state/store';
import { NO_GROUP, groupLabel, groupsOf, type DocItem } from '../types';
import { ProgressSegments, type DonutSegment } from './charts';
import { AiBadge, ReviewBadge, SimilarityBadge, kindLabel, percentText } from './common';
import { Icon } from './icons';
import { Highlighted, matchesSearch, SearchBox } from './SearchBox';

type SortKey = 'order' | 'name' | 'similarity' | 'ai' | 'status';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'order', label: 'Upload order' },
  { key: 'name', label: 'Student (A–Z)' },
  { key: 'similarity', label: 'Similarity (high first)' },
  { key: 'ai', label: 'AI indicators (high first)' },
  { key: 'status', label: 'Pending first' },
];

const STATUS_ORDER = { pending: 0, 'needs-corrections': 1, approved: 2 } as const;

function progressOf(docs: DocItem[]): DonutSegment[] {
  return [
    { key: 'approved', label: 'Approved', value: docs.filter((d) => d.reviewStatus === 'approved').length, tone: 'ok' },
    { key: 'corrections', label: 'Needs corrections', value: docs.filter((d) => d.reviewStatus === 'needs-corrections').length, tone: 'warn' },
    { key: 'pending', label: 'Pending', value: docs.filter((d) => d.reviewStatus === 'pending').length, tone: 'neutral' },
  ];
}

export function SubmissionsList() {
  const { state, submissions, analysis, go } = useStore();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('order');
  // La lista se filtra con un pequeño retraso para que escribir siempre se sienta fluido
  const deferredQuery = useDeferredValue(query);

  const groups = useMemo(() => groupsOf(submissions), [submissions]);
  const hasUngrouped = submissions.some((d) => !d.group?.trim());
  const tabs = [...groups, ...(hasUngrouped && groups.length ? [NO_GROUP] : [])];
  const activeGroup = group === 'all' || tabs.includes(group) ? group : 'all';

  const rows = useMemo(() => {
    const filtered = submissions.filter(
      (d) =>
        (activeGroup === 'all' || groupLabel(d.group) === activeGroup) &&
        matchesSearch(deferredQuery, [d.studentName, d.group, d.assignmentTitle, d.fileName]),
    );
    const score = (a: DocAnalysis | undefined) =>
      sort === 'similarity' ? -(a?.similarity.percent ?? 0) : sort === 'ai' ? -(a?.ai?.percent ?? 0) : 0;
    const sorted = [...filtered];
    if (sort === 'name') sorted.sort((x, y) => x.studentName.localeCompare(y.studentName, 'es', { sensitivity: 'base' }));
    else if (sort === 'status') sorted.sort((x, y) => STATUS_ORDER[x.reviewStatus] - STATUS_ORDER[y.reviewStatus]);
    else if (sort !== 'order') sorted.sort((x, y) => score(analysis.byId.get(x.id)) - score(analysis.byId.get(y.id)));
    return sorted;
  }, [submissions, activeGroup, deferredQuery, sort, analysis]);

  // Con "All groups" y más de un grupo, la lista se divide en secciones por grupo
  const sections = useMemo(() => {
    if (activeGroup !== 'all' || tabs.length < 2) return [{ name: null as string | null, docs: rows }];
    return tabs
      .map((g) => ({ name: g, docs: rows.filter((d) => groupLabel(d.group) === g) }))
      .filter((s) => s.docs.length);
  }, [rows, activeGroup, tabs]);

  const countFor = (g: string) => submissions.filter((d) => groupLabel(d.group) === g).length;
  const all = progressOf(submissions);
  const reviewed = submissions.length - all[2].value;
  const references = state.docs.filter((d) => d.analyzed && d.isReference).length;

  return (
    <section className="card submissions-card">
      <div className="card-header">
        <div>
          <h2>Submissions</h2>
          <p className="muted-text small">
            Similarity threshold: {state.settings.similarityThreshold}%
            {references > 0 && ` · ${references} reference file${references === 1 ? '' : 's'}`}
            {groups.length > 0 && ` · ${groups.length} group${groups.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="progress-wrap">
          <span className="small muted-text">
            {reviewed}/{submissions.length} reviewed
          </span>
          <ProgressSegments segments={all} />
        </div>
      </div>

      <div className="list-toolbar">
        <SearchBox
          id="submissions-search"
          value={query}
          onChange={setQuery}
          label="Search submissions"
          placeholder="Search by student, group, assignment or file…"
          shortcut
        />
        <label className="sort-select">
          <span className="sr-only">Sort submissions</span>
          <select className="input select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tabs.length > 0 && (
        <div className="group-tabs" role="tablist" aria-label="Filter by group">
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === 'all'}
            className="group-tab"
            onClick={() => setGroup('all')}
          >
            All groups <span className="group-count">{submissions.length}</span>
          </button>
          {tabs.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={activeGroup === g}
              className={`group-tab${g === NO_GROUP ? ' is-none' : ''}`}
              onClick={() => setGroup(g)}
            >
              {g} <span className="group-count">{countFor(g)}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty-inline list-empty">
          <Icon name="inbox" size={20} />
          <span>
            No submissions match{deferredQuery ? ` “${deferredQuery}”` : ''}
            {activeGroup !== 'all' ? ` in ${activeGroup}` : ''}.
          </span>
          <button
            type="button"
            className="button button-link"
            onClick={() => {
              setQuery('');
              setGroup('all');
            }}
          >
            Show all
          </button>
        </div>
      ) : (
        <div className={`table-fade${query !== deferredQuery ? ' is-stale' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Group</th>
                <th scope="col">Assignment</th>
                <th scope="col">Type</th>
                <th scope="col">Similarity</th>
                <th scope="col">AI indicators</th>
                <th scope="col">Review</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {sections.map((s) => {
              const p = progressOf(s.docs);
              return (
                <tbody key={s.name ?? 'all'}>
                  {s.name && (
                    <tr className="group-row">
                      <th colSpan={8} scope="rowgroup">
                        <span className="group-row-inner">
                          <span className="group-row-name">{s.name}</span>
                          <span className="small muted-text">
                            {s.docs.length} submission{s.docs.length === 1 ? '' : 's'} · {s.docs.length - p[2].value} reviewed
                          </span>
                          <ProgressSegments segments={p} />
                        </span>
                      </th>
                    </tr>
                  )}
                  {s.docs.map((d) => {
                    const a = analysis.byId.get(d.id);
                    return (
                      <tr key={d.id} className="row-link" onClick={() => go('review', d.id)}>
                        <td>
                          <span className="student-cell">
                            <span className="mini-avatar" aria-hidden="true">
                              {d.studentName.charAt(0).toUpperCase()}
                            </span>
                            <span className="strong">
                              <Highlighted text={d.studentName} query={deferredQuery} />
                            </span>
                          </span>
                        </td>
                        <td>
                          {d.group ? (
                            <span className="group-chip">
                              <Highlighted text={d.group} query={deferredQuery} />
                            </span>
                          ) : (
                            <span className="muted-text">—</span>
                          )}
                        </td>
                        <td>
                          <Highlighted text={d.assignmentTitle} query={deferredQuery} />
                        </td>
                        <td>
                          <span className="file-chip">{kindLabel(d.kind)}</span>
                        </td>
                        <td>
                          {a && (
                            <span className="cell-flex">
                              <span className="num">{percentText(a.similarity.percent)}</span>
                              <SimilarityBadge status={a.status} />
                            </span>
                          )}
                        </td>
                        <td>
                          {a?.ai ? (
                            <span className="cell-flex">
                              <span className="num">{a.ai.percent}%</span>
                              <AiBadge level={a.ai.level} />
                            </span>
                          ) : (
                            <span className="muted-text">Off</span>
                          )}
                        </td>
                        <td>
                          <ReviewBadge status={d.reviewStatus} />
                        </td>
                        <td className="right">
                          <button
                            type="button"
                            className="button button-link"
                            aria-label={`Open review for ${d.studentName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              go('review', d.id);
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      {rows.length > 0 && (deferredQuery || activeGroup !== 'all') && (
        <p className="small muted-text list-count">
          Showing {rows.length} of {submissions.length} submissions.
        </p>
      )}
    </section>
  );
}
