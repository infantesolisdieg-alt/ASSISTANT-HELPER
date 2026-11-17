import { useState } from 'react';
import { useStore, type View } from '../state/store';
import { Modal } from './common';

const NAV: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'upload', label: 'Upload' },
  { view: 'review', label: 'Submission Review' },
  { view: 'plagiarism', label: 'Plagiarism Detector' },
  { view: 'ai', label: 'AI Indicators' },
  { view: 'settings', label: 'Settings' },
];

export function Sidebar() {
  const { state, dispatch, go, notify } = useStore();
  const [confirming, setConfirming] = useState(false);
  const fileCount = state.docs.length;

  const clear = () => {
    dispatch({ type: 'clearAll' });
    setConfirming(false);
    notify('All files and results have been removed from this session.');
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          AH
        </span>
        <span className="brand-name">Assistant Helper</span>
      </div>

      <nav aria-label="Main navigation">
        <ul className="nav-list">
          {NAV.map((item) => (
            <li key={item.view}>
              <button
                type="button"
                className={`nav-item${state.view === item.view ? ' active' : ''}`}
                aria-current={state.view === item.view ? 'page' : undefined}
                onClick={() => go(item.view)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-bottom">
        <div className="session-box">
          <p className="session-title">Session files</p>
          <p className="session-text">
            {fileCount === 0 ? 'No files loaded.' : `${fileCount} file${fileCount === 1 ? '' : 's'} in memory.`} Nothing is saved
            on a server.
          </p>
          <button type="button" className="button button-secondary full" onClick={() => setConfirming(true)}>
            Clear temporary files
          </button>
        </div>

        <div className="profile">
          <span className="avatar" aria-hidden="true">
            NO
          </span>
          <div>
            <p className="profile-name">Nalleli Olvera Castelan</p>
            <p className="profile-role">Teacher · Bilingual Executive Secretary</p>
          </div>
        </div>
      </div>

      {confirming && (
        <Modal
          title="Clear temporary files?"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" className="button button-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={clear}>
                Clear all files
              </button>
            </>
          }
        >
          <p>
            This removes every uploaded document, analysis result, teacher note and review decision from this session. This
            cannot be undone. Your criteria in Settings are kept.
          </p>
        </Modal>
      )}
    </aside>
  );
}
