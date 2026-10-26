import Icon from './Icon.jsx';

export function Notice({ children, tone = 'info', onDismiss }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info'} size={19} />
      <div>{children}</div>
      {onDismiss && (
        <button className="icon-button" aria-label="Dismiss message" onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export function Busy({ children = 'Loading…' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {children}
    </div>
  );
}

export function Empty({ title, children, icon = 'file' }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
