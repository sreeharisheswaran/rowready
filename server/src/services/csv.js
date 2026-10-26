import { csvParseRows, csvFormatRows } from 'd3-dsv';
import { LIMITS } from '../../../shared/limits.js';
import { AppError } from '../middleware/errors.js';
import { validateDataset } from './dataset.js';
import { isFormulaRisk, spreadsheetValue } from '../../../shared/export-policy.js';
export { isFormulaRisk } from '../../../shared/export-policy.js';

// d3-dsv handles decoding/encoding. This guard rejects malformed quoting that
// its intentionally permissive parser would otherwise accept.
function checkQuoting(text) {
  let state = 'start';
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (state === 'quoted') {
      if (character === '"') {
        if (text[i + 1] === '"') i += 1;
        else state = 'closed';
      }
    } else if (character === ',' || character === '\r' || character === '\n') {
      state = 'start';
      if (character === '\r' && text[i + 1] === '\n') i += 1;
    } else if (character === '"' && state === 'start') {
      state = 'quoted';
    } else if (character === '"' || state === 'closed') {
      throw new AppError(
        400,
        'MALFORMED_CSV',
        'Invalid CSV quoting. Quote the entire field, escape a quote as "", and place a comma or line break immediately after the closing quote.',
      );
    } else {
      state = 'unquoted';
    }
  }
  if (state === 'quoted')
    throw new AppError(
      400,
      'MALFORMED_CSV',
      'A quoted field is not closed. Check the double quotes in your CSV.',
    );
}

export function parseCsv(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw new AppError(
      400,
      'EMPTY_CSV',
      'The CSV is empty. Include a header and at least one data row.',
    );
  if (bytes.length > LIMITS.fileBytes)
    throw new AppError(413, 'FILE_TOO_LARGE', 'CSV files must be 2 MiB or smaller.');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new AppError(
      400,
      'INVALID_ENCODING',
      'Save the file as UTF-8 CSV. UTF-16 and binary files are not supported.',
    );
  }
  if (!text.trim())
    throw new AppError(
      400,
      'EMPTY_CSV',
      'The CSV is empty. Include a header and at least one data row.',
    );
  checkQuoting(text);
  const records = csvParseRows(text, (row, index) => {
    if (index > LIMITS.rows)
      throw new AppError(413, 'TOO_MANY_ROWS', 'CSV files can contain at most 10,000 data rows.');
    if (row.length > LIMITS.columns)
      throw new AppError(413, 'TOO_MANY_COLUMNS', 'CSV files can contain at most 100 columns.');
    return row;
  });
  if (records.length < 2)
    throw new AppError(
      400,
      'NO_DATA_ROWS',
      'The CSV has no data rows. Include a header followed by at least one record.',
    );
  return validateDataset({ headers: records[0], rows: records.slice(1) });
}

export function serializeCsv(dataset, { spreadsheetSafe = true } = {}) {
  let escapedCells = 0;
  const records = [dataset.headers, ...dataset.rows].map((row) =>
    row.map((value) => {
      if (spreadsheetSafe && isFormulaRisk(value)) {
        escapedCells += 1;
        return spreadsheetValue(value);
      }
      return value;
    }),
  );
  return { csv: `${records.map((row) => csvFormatRows([row])).join('\r\n')}\r\n`, escapedCells };
}
