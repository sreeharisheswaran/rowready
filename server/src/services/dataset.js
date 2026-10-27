import { z } from 'zod';
import { LIMITS } from '../../../shared/limits.js';
import { AppError } from '../middleware/errors.js';

const forbiddenControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const cell = z
  .string()
  .max(LIMITS.cellCharacters)
  .refine((value) => !forbiddenControls.test(value));
const datasetSchema = z
  .object({
    headers: z
      .array(
        z
          .string()
          .min(1)
          .max(LIMITS.headerCharacters)
          .refine((value) => value.trim().length > 0 && !forbiddenControls.test(value)),
      )
      .min(1)
      .max(LIMITS.columns),
    rows: z.array(z.array(cell).min(1).max(LIMITS.columns)).min(1).max(LIMITS.rows),
  })
  .strict();

export function validateDataset(input) {
  const result = datasetSchema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      400,
      'INVALID_DATASET',
      `Use 1–${LIMITS.rows.toLocaleString('en-US')} data rows, 1–${LIMITS.columns} named columns, and text cells of at most ${LIMITS.cellCharacters} characters. Headers must be nonblank and at most ${LIMITS.headerCharacters} characters. Control characters are not supported.`,
    );
  }
  const dataset = result.data;
  if (new Set(dataset.headers.map((header) => header.trim())).size !== dataset.headers.length) {
    throw new AppError(
      400,
      'DUPLICATE_HEADERS',
      'Column names must be unique after ignoring surrounding whitespace (case-sensitive). Rename repeated headers.',
    );
  }
  const inconsistent = dataset.rows.findIndex((row) => row.length !== dataset.headers.length);
  if (inconsistent !== -1) {
    throw new AppError(
      400,
      'INCONSISTENT_ROWS',
      `Data row ${inconsistent + 1} has ${dataset.rows[inconsistent].length} cells; expected ${dataset.headers.length}. Check delimiters and blank lines.`,
    );
  }
  if (
    dataset.rows.length * dataset.headers.length > LIMITS.cells ||
    Buffer.byteLength(JSON.stringify(dataset), 'utf8') > LIMITS.datasetBytes
  ) {
    throw new AppError(
      413,
      'DATASET_TOO_LARGE',
      `The parsed dataset exceeds ${LIMITS.cells.toLocaleString('en-US')} cells or ${Math.round(LIMITS.datasetBytes / (1024 * 1024))} MiB of working data. Split it into smaller files.`,
    );
  }
  return dataset;
}

export const operationSchema = z
  .array(z.enum(['trim', 'deduplicate']))
  .min(1)
  .max(2)
  .refine((operations) => new Set(operations).size === operations.length);

export function parseRequest(schema, input, defaultMessage) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues?.[0];
    const message =
      issue && issue.message && !issue.message.startsWith('Invalid input')
        ? issue.message
        : defaultMessage ||
          'Invalid request fields or operations. Supported operations are trim and deduplicate, each at most once.';
    throw new AppError(400, 'INVALID_REQUEST', message);
  }
  return result.data;
}

export function safeFilename(input) {
  if (typeof input !== 'string' || input.length > 1024 || !/\.csv$/i.test(input)) {
    throw new AppError(400, 'INVALID_FILENAME', 'Choose a file with a .csv extension.');
  }
  const basename = input.replaceAll('\\', '/').split('/').at(-1);
  const safe = basename
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (!safe || safe.toLowerCase() === 'csv' || !/\.csv$/i.test(safe))
    throw new AppError(400, 'INVALID_FILENAME', 'Use a valid CSV filename.');
  const stem = safe.slice(0, -4).slice(0, LIMITS.filenameCharacters - 4) || 'dataset';
  return `${stem}.csv`;
}
