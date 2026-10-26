import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Busy, Empty, Notice } from '../components/Feedback.jsx';
import { Metrics, ColumnProfile, Warnings } from '../components/Profile.jsx';
import Icon from '../components/Icon.jsx';
import { dateTime, fileSize, number } from '../utils/format.js';

export function Reports({ navigate }) {
  const [state, setState] = useState({ reports: [], loading: true, error: '', hasMore: false });
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    api
      .reports(offset, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ ...result, loading: false, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ reports: [], hasMore: false, loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [offset, reload]);
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">A RECORD OF WHAT YOU FOUND</span>
          <h1>Saved reports</h1>
          <p>Your analysis and latest validation findings, ready to revisit.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => setReload((value) => value + 1)}
          disabled={state.loading}
        >
          <Icon name="reset" size={16} />
          Refresh reports
        </button>
      </header>
      <Notice>
        Reports on this instance are shared publicly. They contain filenames, column names, and
        quality statistics, with no full datasets. Upload the CSV again to begin another cleaning
        session.
      </Notice>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Report history</h2>
            <p>Newest uploads first</p>
          </div>
          <span className="tag">MongoDB storage</span>
        </div>
        {state.loading ? (
          <Busy>Loading saved reports…</Busy>
        ) : !state.reports.length ? (
          <Empty
            title={
              state.error ? 'Reports could not be loaded' : 'Your first report starts with a CSV'
            }
            icon="history"
          >
            {state.error
              ? 'Check the database connection, then use Refresh reports to retry.'
              : 'Analyze a dataset in the workbench and its report will appear here.'}
          </Empty>
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Saved report history"
          >
            <table className="report-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Original size</th>
                  <th>Latest findings</th>
                  <th>Saved validation</th>
                  <th>
                    <span className="visually-hidden">Open report</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.reports.map((report) => {
                  const latest = report.lastValidation?.profile || report.original;
                  return (
                    <tr key={report.id}>
                      <td>
                        <a
                          className="report-link"
                          href={`/reports/${report.id}`}
                          onClick={(event) => {
                            if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
                              event.preventDefault();
                              navigate(`/reports/${report.id}`);
                            }
                          }}
                        >
                          <Icon name="file" size={21} />
                          <span>
                            <strong>{report.filename}</strong>
                            <small>{dateTime(report.createdAt)}</small>
                          </span>
                        </a>
                      </td>
                      <td>
                        {number(report.original.rowCount)} rows
                        <small className="block muted">{report.original.columnCount} columns</small>
                      </td>
                      <td>
                        <span
                          className={`tag ${latest.warnings.length ? 'tag-amber' : 'tag-green'}`}
                        >
                          {latest.warnings.length} warning categories
                        </span>
                      </td>
                      <td className="small muted">
                        {report.lastValidation
                          ? dateTime(report.lastValidation.validatedAt)
                          : 'Not yet validated'}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Open report ${report.filename}`}
                          onClick={() => navigate(`/reports/${report.id}`)}
                        >
                          <Icon name="chevron" size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span className="small muted">Page {Math.floor(offset / 12) + 1}</span>
          <div className="button-row">
            <button
              className="button secondary small"
              disabled={state.loading || offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - 12))}
            >
              Previous
            </button>
            <button
              className="button secondary small"
              disabled={state.loading || !state.hasMore || offset + 12 > 1000}
              onClick={() => setOffset((value) => value + 12)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ReportDetail({ id, navigate }) {
  const [state, setState] = useState({ report: null, loading: true, error: '' });
  const [reload, setReload] = useState(0);
  const [version, setVersion] = useState('latest');
  useEffect(() => {
    const controller = new AbortController();
    setState({ report: null, loading: true, error: '' });
    api
      .report(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ ...result, loading: false, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ report: null, loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [id, reload]);
  const report = state.report;
  const profile =
    version === 'latest' && report?.lastValidation
      ? report.lastValidation.profile
      : report?.original;
  return (
    <div className="page">
      <button className="text-button back-link" onClick={() => navigate('/reports')}>
        ← All saved reports
      </button>
      <header className="page-heading">
        <div>
          <span className="eyebrow">SAVED REPORT</span>
          <h1 className="filename-heading">{report?.filename || 'Report details'}</h1>
          <p>
            {report
              ? `Uploaded ${dateTime(report.createdAt)} · ${fileSize(report.sourceBytes)}`
              : 'Analysis and saved validation information'}
          </p>
        </div>
      </header>
      {state.loading && <Busy>Loading report…</Busy>}
      {state.error && (
        <>
          <Notice tone="error">{state.error}</Notice>
          <button className="button secondary" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </>
      )}
      {report && (
        <>
          <Notice>
            Only the report is saved. To inspect or clean row values, return to an active workbench
            session or upload the source CSV again. Last report update: {dateTime(report.updatedAt)}
            .
          </Notice>
          <div className="version-selector">
            <label htmlFor="report-version">Showing</label>
            <select
              id="report-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            >
              <option value="latest">
                {report.lastValidation ? 'Latest saved validation' : 'Original analysis'}
              </option>
              {report.lastValidation && <option value="original">Original analysis</option>}
            </select>
            <span className="muted small">
              {report.lastValidation && version === 'latest'
                ? `Validated ${dateTime(report.lastValidation.validatedAt)}`
                : 'At upload'}
            </span>
          </div>
          <Metrics profile={profile} />
          <section className="panel">
            <div className="panel-heading">
              <h2>Saved findings</h2>
              <span className="tag">{profile.warnings.length} warning categories</span>
            </div>
            <div className="panel-body">
              <Warnings profile={profile} />
            </div>
          </section>
          <ColumnProfile profile={profile} />
          <p className="small muted">Report ID: {report.id}</p>
        </>
      )}
    </div>
  );
}
