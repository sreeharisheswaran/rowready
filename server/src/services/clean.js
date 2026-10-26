import { operationSchema, parseRequest } from './dataset.js';
import { rowKey } from './profile.js';

export function cleanDataset(dataset, requestedOperations) {
  const operations = parseRequest(operationSchema, requestedOperations);
  let rows = dataset.rows.map((row) => [...row]);
  const changes = { trimmedCells: 0, removedRows: 0 };
  // Canonical order makes selecting both operations deterministic, regardless
  // of request order. Newly identical rows after trimming are removed too.
  if (operations.includes('trim')) {
    rows = rows.map((row) =>
      row.map((value) => {
        const trimmed = value.trim();
        if (trimmed !== value) changes.trimmedCells += 1;
        return trimmed;
      }),
    );
  }
  if (operations.includes('deduplicate')) {
    const seen = new Set();
    rows = rows.filter((row) => {
      const key = rowKey(row);
      if (seen.has(key)) {
        changes.removedRows += 1;
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  return {
    dataset: { headers: [...dataset.headers], rows },
    changes,
    operations: ['trim', 'deduplicate'].filter((operation) => operations.includes(operation)),
  };
}
