async function send(path, options = {}) {
  const timeout = AbortSignal.timeout(30000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('rowready_token') : null;
  const headers = { ...options.headers };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, signal });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(
      error.name === 'TimeoutError'
        ? 'The request timed out. Check the connection and try again.'
        : 'Could not reach the API. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(
      body?.error?.message || `Request failed (${response.status}). Please try again.`,
    );
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return response;
}

const jsonPost = async (path, body) =>
  (
    await send(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();

export const api = {
  signup: (data) => jsonPost('/auth/signup', data),
  login: (data) => jsonPost('/auth/login', data),
  me: async (signal) => (await send('/auth/me', { signal })).json(),
  analyze: async (file) =>
    (
      await send('/datasets/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv', 'X-Filename': encodeURIComponent(file.name) },
        body: file,
      })
    ).json(),
  clean: (dataset, operations) => jsonPost('/datasets/clean', { dataset, operations }),
  validate: (dataset, reportId, editToken) =>
    jsonPost('/datasets/validate', { dataset, reportId, editToken }),
  reports: async (offset = 0, signal, mine = false) =>
    (
      await send(`/reports?limit=12&offset=${offset}${mine ? '&mine=true' : ''}`, { signal })
    ).json(),
  report: async (id, signal) =>
    (await send(`/reports/${encodeURIComponent(id)}`, { signal })).json(),
  export: async (dataset) => {
    const response = await send('/datasets/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset }),
    });
    return {
      blob: await response.blob(),
      protectedCells: Number(response.headers.get('X-Protected-Cells') || 0),
    };
  },
  health: async (signal) => {
    const response = await fetch('/api/health', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    const body = await response.json();
    if (![200, 503].includes(response.status) || !body.database) throw new Error('API unavailable');
    return body;
  },
};
