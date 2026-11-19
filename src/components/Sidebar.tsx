import { useState } from 'react';
import { useStore, type View } from '../state/store';
import { initials } from '../types';
import { Modal } from './common';
import { Icon, type IconName } from './icons';

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { view: 'upload', label: 'Upload', icon: 'upload' },
  { view: 'review', label: 'Submission Review', icon: 'review' },
  { view: 'plagiarism', label: 'Plagiarism Detector', icon: 'plagiarism' },
  { view: 'ai', label: 'AI Indicators', icon: 'ai' },
  { view: 'settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar() {
  const { state, dispatch, submissions, go, notify } = useStore();
  const [confirm, setConfirm] = useState<'clear' | 'switch' | null>(null);
  const fileCount = state.docs.length;
  const pending = submissions.filter((d) => d.reviewStatus === 'pending').length;
  const profile = state.profile!;

  const clear = () => {
    dispatch({ type: 'clearAll' });
    setConfirm(null);
    notify('All files and results have been removed from this session.');
  };

  const switchTeacher = () => {
    setConfirm(null);
    dispatch({ type: 'signOut' });
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src="/logo-mark.svg" alt="" width="40" height="40" />
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
                <Icon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                {item.view === 'review' && pending > 0 && (
                  <span className="nav-count" aria-label={`${pending} pending`}>
                    {pending}
                  </span>
                )}
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
          <button type="button" className="button button-secondary full" onClick={() => setConfirm('clear')}>
            <Icon name="trash" size={16} /> Clear temporary files
          </button>
        </div>

        <div className="profile">
          <span className="avatar" aria-hidden="true">
            {initials(profile.name)}
          </span>
          <div className="profile-info">
            <p className="profile-name">{profile.name}</p>
            <p className="profile-role">{profile.role}</p>
            {profile.group && <p className="profile-role">{profile.group}</p>}
          </div>
          <button
            type="button"
            className="icon-button profile-switch"
            aria-label="Change teacher"
            title="Change teacher"
            onClick={() => (fileCount > 0 ? setConfirm('switch') : switchTeacher())}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>

      {confirm === 'clear' && (
        <Modal
          title="Clear temporary files?"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="button button-secondary" onClick={() => setConfirm(null)}>
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

      {confirm === 'switch' && (
        <Modal
          title="Change teacher?"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="button button-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={switchTeacher}>
                End session
              </button>
            </>
          }
        >
          <p>
            This ends the session for {profile.name}. All files, results, notes and settings are removed so the next teacher
            starts with a clean session. Export your settings first if you want to keep them.
          </p>
        </Modal>
      )}
    </aside>
  );
}
