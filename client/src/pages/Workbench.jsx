import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Upload from '../components/Upload.jsx';
import DataPreview from '../components/DataPreview.jsx';
import { Metrics, ColumnProfile, Warnings } from '../components/Profile.jsx';
import { Notice } from '../components/Feedback.jsx';
import { fileSize, dateTime, number } from '../utils/format.js';

function GettingStarted() {
  const steps = [
    ['Understand your data', 'See missing values, duplicate rows, and a profile of every column.'],
    [
      'Make thoughtful changes',
      'Trim extra whitespace and remove exact duplicates. Compare with your original.',
    ],
    [
      'Check, then take it with you',
      'Revalidate the result, save your findings, and download a safer CSV.',
    ],
  ];
  return (
    <aside className="getting-started">
      <h2>
        From messy rows
        <br />
        to ready to go.
      </h2>
      <div className="steps">
        {steps.map(([title, description], index) => (
          <div className="step" key={title}>
            <span className="step-number">0{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="quiet-card">
        <Icon name="info" size={19} />
        <p>
          Your original stays intact. Cleaning is explicit, predictable, and always resettable
          during the session.
        </p>
      </div>
    </aside>
  );
}

function CleanPanel({ work }) {
  const [trim, setTrim] = useState(true);
  const [deduplicate, setDeduplicate] = useState(true);
  const { session, pending } = work;
  const operations = [trim && 'trim', deduplicate && 'deduplicate'].filter(Boolean);
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Choose what to clean</h2>
            <p>Choose the changes to apply to your current working data.</p>
          </div>
          <Icon name="clean" />
        </div>
        <div className="operation-grid">
          <label className={`operation ${trim ? 'selected' : ''}`}>
            <input
              type="checkbox"
              checked={trim}
              onChange={(event) => setTrim(event.target.checked)}
              disabled={Boolean(pending)}
            />
            <div>
              <h3>Trim whitespace</h3>
              <p>
                Remove leading and trailing whitespace in data cells. Keep headers, internal spaces,
                and values as text.
              </p>
              <span className="tag">
                {number(session.profile.whitespaceCells)} cells currently affected
              </span>
            </div>
          </label>
          <label className={`operation ${deduplicate ? 'selected' : ''}`}>
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(event) => setDeduplicate(event.target.checked)}
              disabled={Boolean(pending)}
            />
            <div>
              <h3>Remove exact duplicates</h3>
              <p>
                Keep the first occurrence of each identical row, in its original order. Compare
                every cell, case-sensitive.
              </p>
              <span className="tag">
                {number(session.profile.duplicateRows)} duplicates before trimming
              </span>
            </div>
          </label>
        </div>
        <div className="panel-action">
          <p className="small muted">
            When both are selected, trimming runs first. This may reveal more duplicates.
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={work.reset} disabled={Boolean(pending)}>
              <Icon name="reset" size={16} />
              Reset to original
            </button>
            <button
              className="button primary"
              disabled={Boolean(pending) || !operations.length}
              onClick={() => work.clean(operations)}
            >
              {pending === 'clean' ? <span className="spinner" /> : <Icon name="clean" size={16} />}
              {pending === 'clean' ? 'Applying…' : 'Apply cleaning'}
            </button>
          </div>
        </div>
      </section>
      {session.changes && (
        <div className="change-strip">
          <Icon name="check" />
          <strong>Last operation</strong>
          <span>{number(session.changes.trimmedCells)} cells trimmed</span>
          <span>{number(session.changes.removedRows)} rows removed</span>
        </div>
      )}
      <div className="section-title">
        <div>
          <h2>Before & after</h2>
          <p>
            Compare the untouched upload with your working data. Row numbers restart after
            duplicates are removed.
          </p>
        </div>
      </div>
      <div className="comparison">
        <DataPreview
          dataset={session.original}
          title="Original upload"
          description={`${number(session.original.rows.length)} rows · preserved for this session`}
        />
        <DataPreview
          dataset={session.working}
          title="Working dataset"
          description={`${number(session.working.rows.length)} rows · current changes`}
        />
      </div>
      <div className="next-step">
        <span>Happy with these changes?</span>
        <button
          className="text-button"
          disabled={Boolean(pending)}
          onClick={() => work.setTab('validate')}
        >
          Revalidate your data <Icon name="arrow" size={17} />
        </button>
      </div>
    </div>
  );
}

function ValidationPanel({ work }) {
  const { session, pending } = work;
  const isValidated = session.validatedRevision === session.revision;
  return (
    <div className="stack">
      <div className="validation-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className={`tag ${isValidated ? 'tag-green' : 'tag-amber'}`}>
                {isValidated ? 'Current validation saved' : 'Validation needed'}
              </span>
              <h2 className="spaced-heading">Check the current result</h2>
              <p>Recalculate every supported metric and save this working version’s findings.</p>
            </div>
            <Icon name="shield" size={28} />
          </div>
          <div className="panel-body">
            <Warnings profile={session.profile} />
            <button
              className="button primary full-width"
              onClick={work.validate}
              disabled={Boolean(pending)}
            >
              {pending === 'validate' ? (
                <span className="spinner" />
              ) : (
                <Icon name="check" size={17} />
              )}
              {pending === 'validate' ? 'Validating & saving…' : 'Revalidate & save report'}
            </button>
            {isValidated && (
              <p className="small muted">
                Saved {dateTime(session.report.lastValidation.validatedAt)}
              </p>
            )}
          </div>
        </section>
        <section className="export-card">
          <span className="export-icon">
            <Icon name="download" size={29} />
          </span>
          <h2>Export your cleaned data</h2>
          <p>
            Download your actual working data, with correctly escaped commas, quotes, and line
            breaks.
          </p>
          <div className="export-details">
            <span>
              Working rows<strong>{number(session.working.rows.length)}</strong>
            </span>
            <span>
              Columns<strong>{number(session.working.headers.length)}</strong>
            </span>
            <span>
              Protected cells / headers<strong>{number(session.profile.formulaCells)}</strong>
            </span>
          </div>
          <button
            className="button primary full-width"
            disabled={Boolean(pending) || !isValidated}
            onClick={work.exportCsv}
          >
            {pending === 'export' ? (
              <span className="spinner" />
            ) : (
              <Icon name="download" size={18} />
            )}
            {pending === 'export' ? 'Preparing CSV…' : 'Download cleaned CSV'}
          </button>
          <p className="small">
            {isValidated
              ? 'Warnings can remain. Review them before using the exported data.'
              : 'Revalidate and save the current version to enable download.'}
          </p>
        </section>
      </div>
      <Notice>
        Spreadsheet protection is always enabled. Potential formulas (including negative numbers and
        risky headers) get a leading apostrophe in the download. The preview below shows those exact
        export values. Working data remains unchanged.
      </Notice>
      <DataPreview dataset={session.working} title="Safe export preview" exportSafe />
    </div>
  );
}

export default function Workbench({ work, navigate }) {
  const { session, pending, error, message, tab } = work;
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1>{session ? 'A clearer picture of your data.' : 'Good data starts here.'}</h1>
          <p>
            {session
              ? 'Inspect the details. Make a careful edit. Know what you’re taking with you.'
              : 'Find the gaps, tidy the details, and turn your CSV into something you can trust.'}
          </p>
        </div>
        {session && (
          <button className="button secondary" disabled={Boolean(pending)} onClick={work.newUpload}>
            <Icon name="upload" size={16} />
            New upload
          </button>
        )}
      </header>
      {error && (
        <Notice tone="error" onDismiss={work.dismissError}>
          {error}
        </Notice>
      )}
      {message && <Notice tone="success">{message}</Notice>}
      {!session ? (
        <>
          <div className="welcome-grid">
            <Upload onUpload={work.upload} pending={pending === 'upload'} onError={work.setError} />
            <GettingStarted />
          </div>
          <div className="feature-line">
            <span>
              <Icon name="shield" size={18} />
              Original data preserved
            </span>
            <span>
              <Icon name="clean" size={18} />
              Only explicit changes
            </span>
            <span>
              <Icon name="history" size={18} />
              Reports saved in MongoDB
            </span>
          </div>
          <section className="history-callout">
            <div>
              <h3>Saved reports</h3>
              <p>
                Revisit saved analysis and validation reports, even after the dataset session ends.
              </p>
            </div>
            <button className="text-button" onClick={() => navigate('/reports')}>
              View saved reports <Icon name="arrow" size={18} />
            </button>
          </section>
        </>
      ) : (
        <>
          <section className="file-strip">
            <span className="file-icon">
              <Icon name="file" size={23} />
            </span>
            <div className="file-info">
              <strong>{session.report.filename}</strong>
              <span>
                {fileSize(session.report.sourceBytes)} · Uploaded{' '}
                {dateTime(session.report.createdAt)}
              </span>
            </div>
            <span className="tag tag-green">
              <span className="status-dot" />
              Report saved
            </span>
            <button
              className="text-button small"
              disabled={Boolean(pending)}
              onClick={() => navigate(`/reports/${session.report.id}`)}
            >
              View report <Icon name="arrow" size={15} />
            </button>
          </section>
          <Metrics profile={session.profile} />
          <div className="tabs" role="tablist" aria-label="Dataset workflow">
            {[
              ['overview', '01', 'Overview'],
              ['clean', '02', 'Clean & compare'],
              ['validate', '03', 'Validate & export'],
            ].map(([key, step, label], index, tabs) => (
              <button
                key={key}
                id={`tab-${key}`}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                disabled={Boolean(pending)}
                className={tab === key ? 'active' : ''}
                onClick={() => work.setTab(key)}
                onKeyDown={(event) => {
                  const nextIndex =
                    event.key === 'ArrowRight'
                      ? (index + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : null;
                  if (nextIndex !== null) {
                    event.preventDefault();
                    work.setTab(tabs[nextIndex][0]);
                    document.getElementById(`tab-${tabs[nextIndex][0]}`).focus();
                  }
                }}
              >
                <span>{step}</span>
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
            {tab === 'overview' && (
              <>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>What needs a closer look</h2>
                      <p>Findings from your current working dataset.</p>
                    </div>
                    <button className="text-button" onClick={() => work.setTab('clean')}>
                      Start cleaning <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  <div className="panel-body">
                    <Warnings profile={session.profile} />
                  </div>
                </section>
                <ColumnProfile profile={session.profile} />
                <DataPreview dataset={session.working} title="Working dataset preview" />
              </>
            )}
            {tab === 'clean' && <CleanPanel work={work} />}
            {tab === 'validate' && <ValidationPanel work={work} />}
          </div>
        </>
      )}
    </div>
  );
}
