import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { downloadBlob } from './format.js';

export function useWorkspace() {
  const [session, setSession] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('overview');
  const lock = useRef(false);

  useEffect(() => {
    if (!session) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [Boolean(session)]);

  async function run(operation, action) {
    if (lock.current) return;
    lock.current = true;
    setPending(operation);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      lock.current = false;
      setPending('');
    }
  }

  function upload(file) {
    return run('upload', async () => {
      const result = await api.analyze(file);
      setSession({
        original: result.dataset,
        working: result.dataset,
        originalProfile: result.profile,
        profile: result.profile,
        report: result.report,
        editToken: result.editToken,
        revision: 0,
        validatedRevision: null,
        changes: null,
      });
      setTab('overview');
      setMessage(
        'Analysis complete. Your report is saved; your dataset remains in this browser session.',
      );
    });
  }
  function clean(operations) {
    return run('clean', async () => {
      const result = await api.clean(session.working, operations);
      setSession((current) => ({
        ...current,
        working: result.dataset,
        profile: result.profile,
        revision: current.revision + 1,
        changes: result.changes,
      }));
      setMessage(
        `${result.changes.trimmedCells} cells trimmed. ${result.changes.removedRows} duplicate rows removed. Revalidate to save the current findings.`,
      );
    });
  }
  function reset() {
    if (lock.current) return;
    setSession((current) => ({
      ...current,
      working: current.original,
      profile: current.originalProfile,
      revision: current.revision + 1,
      changes: null,
    }));
    setError('');
    setMessage(
      'Working data reset to the original upload. Revalidate to update the saved validation.',
    );
  }
  function validate() {
    return run('validate', async () => {
      const result = await api.validate(session.working, session.report.id, session.editToken);
      setSession((current) => ({
        ...current,
        profile: result.profile,
        report: result.report,
        validatedRevision: current.revision,
      }));
      setMessage(
        `Validation saved. ${result.profile.warnings.length} warning categories remain. Review them before exporting.`,
      );
    });
  }
  function exportCsv() {
    if (session.validatedRevision !== session.revision) return;
    return run('export', async () => {
      const result = await api.export(session.working);
      downloadBlob(result.blob, `${session.report.filename.slice(0, -4)}-cleaned.csv`);
      setMessage(
        `CSV download prepared with ${session.working.rows.length} rows. ${result.protectedCells} formula-risk cells or headers were protected with an apostrophe.`,
      );
    });
  }
  const dismissError = useCallback(() => setError(''), []);
  return {
    session,
    pending,
    error,
    message,
    tab,
    setTab,
    upload,
    clean,
    reset,
    validate,
    exportCsv,
    setError,
    dismissError,
    clearSession: () => {
      setSession(null);
      setMessage('');
      setError('');
      setTab('overview');
    },
    newUpload: () => {
      if (lock.current) return;
      if (
        !window.confirm(
          'End this browser dataset session? Your saved report stays available. Download your working CSV first if you need it.',
        )
      )
        return;
      setSession(null);
      setMessage('');
      setError('');
      setTab('overview');
    },
  };
}
