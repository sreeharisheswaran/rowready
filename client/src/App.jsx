import { Component, useEffect, useState } from 'react';
import Icon from './components/Icon.jsx';
import { Notice } from './components/Feedback.jsx';
import Workbench from './pages/Workbench.jsx';
import { Reports, ReportDetail } from './pages/Reports.jsx';
import AuthModal from './components/AuthModal.jsx';
import { useWorkspace } from './utils/useWorkspace.js';
import { api } from './services/api.js';

export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>RowReady could not display this page.</h1>
          <p>
            Reload to try again. Saved reports remain available; unsaved browser data will be lost.
          </p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </main>
      );
    return this.props.children;
  }
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [health, setHealth] = useState({ status: 'checking', database: '' });
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const work = useWorkspace();
  const [healthReload, setHealthReload] = useState(0);

  useEffect(() => {
    const changed = () => setPath(window.location.pathname);
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
  }, []);

  // Restore authenticated user on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('rowready_token');
    if (!token) return;
    const controller = new AbortController();
    api
      .me(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setUser(res.user);
      })
      .catch(() => {
        localStorage.removeItem('rowready_token');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const result = await api.health(controller.signal);
        if (!controller.signal.aborted) setHealth(result);
      } catch {
        if (!controller.signal.aborted) setHealth({ status: 'offline', database: 'unavailable' });
      }
    }
    void check();
    const interval = setInterval(check, 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [healthReload]);

  function navigate(destination) {
    if (work.pending) return;
    window.history.pushState({}, '', destination);
    setPath(destination);
    window.scrollTo({ top: 0 });
  }

  function handleSignOut() {
    localStorage.removeItem('rowready_token');
    setUser(null);
  }

  const isReports = path.startsWith('/reports');
  const match = path.match(/^\/reports\/([^/]+)\/?$/);
  const nav = (event, destination) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(destination);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => nav(event, '/')}>
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            RowReady<span className="brand-period">.</span>
          </span>
        </a>
        <span className="sidebar-label">DATA QUALITY WORKBENCH</span>
        <nav aria-label="Main navigation">
          <a
            href="/"
            className={!isReports && path === '/' ? 'nav-link active' : 'nav-link'}
            onClick={(event) => nav(event, '/')}
            aria-current={path === '/' ? 'page' : undefined}
          >
            <Icon name="grid" />
            Workbench
            <Icon name="chevron" size={15} />
          </a>
          <a
            href="/reports"
            className={isReports ? 'nav-link active' : 'nav-link'}
            onClick={(event) => nav(event, '/reports')}
            aria-current={isReports ? 'page' : undefined}
          >
            <Icon name="history" />
            Saved reports
            <Icon name="chevron" size={15} />
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="session-card">
            <Icon name="shield" size={22} />
            <strong>A little care for your data.</strong>
            <p>
              Small, deliberate changes.
              <br />A better starting point.
            </p>
          </div>
          <div className="sidebar-footer">
            <span className="tiny-mark">R</span>
            <span>
              Made for the details.<small>RowReady · v1.0</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <Icon name="chevron" size={13} />
            <strong>{isReports ? 'Saved reports' : 'Data workbench'}</strong>
          </div>
          <div className="topbar-status">
            <span className={`connection ${health.status === 'ok' ? 'connected' : ''}`}>
              <span className="status-dot" />
              {health.status === 'ok'
                ? 'Database connected'
                : health.status === 'checking'
                  ? 'Connecting…'
                  : 'Storage unavailable'}
            </span>
            <span className="topbar-divider" />
            <span className="session-indicator">
              {work.session ? 'Active dataset session' : 'No active dataset'}
            </span>
            <span className="topbar-divider" />
            {user ? (
              <div className="topbar-auth">
                <div className="user-badge" title={user.email}>
                  <div className="user-avatar">{user.name.charAt(0)}</div>
                  <span className="user-name">{user.name}</span>
                </div>
                <button
                  type="button"
                  className="auth-signout-btn"
                  onClick={handleSignOut}
                  title="Sign out of account"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="topbar-auth">
                <button
                  type="button"
                  className="auth-btn"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="auth-btn primary"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {health.status !== 'ok' && health.status !== 'checking' && (
            <div className="service-notice">
              <Notice tone="error">
                {health.status === 'offline'
                  ? 'The API is unreachable.'
                  : 'MongoDB report storage is unavailable.'}{' '}
                Upload and saved-report operations need a working connection.{' '}
                <button
                  className="text-button"
                  onClick={() => setHealthReload((value) => value + 1)}
                >
                  Check again
                </button>
              </Notice>
            </div>
          )}
          {path === '/' ? (
            <Workbench work={work} navigate={navigate} />
          ) : path === '/reports' || path === '/reports/' ? (
            <Reports navigate={navigate} user={user} />
          ) : match ? (
            <ReportDetail key={match[1]} id={match[1]} navigate={navigate} />
          ) : (
            <div className="page">
              <h1>Page not found</h1>
              <p>This page does not exist.</p>
              <button className="button primary" onClick={() => navigate('/')}>
                Return to workbench
              </button>
            </div>
          )}
        </main>
        <footer className="main-footer">
          <span>Clearer data. Confident next steps.</span>
          <span>CSV in. Clarity out.</span>
        </footer>
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)}
      />
    </div>
  );
}
