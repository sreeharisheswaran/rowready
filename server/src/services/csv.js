import { dsvFormat, csvFormatRows } from 'd3-dsv';
import { LIMITS } from '../../../shared/limits.js';
import { AppError } from '../middleware/errors.js';
import { validateDataset } from './dataset.js';
import { isFormulaRisk, spreadsheetValue } from '../../../shared/export-policy.js';
export { isFormulaRisk } from '../../../shared/export-policy.js';

export function decodeCsvBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return '';

  // 1. Check for BOM signatures
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3));
    } catch {
      throw new AppError(400, 'INVALID_ENCODING', 'The UTF-8 file contains invalid byte sequences.');
    }
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const payload = bytes.subarray(2);
    if (payload.length % 2 !== 0) {
      throw new AppError(400, 'INVALID_ENCODING', 'Invalid UTF-16 encoding: unexpected byte length.');
    }
    try {
      return new TextDecoder('utf-16le', { fatal: true }).decode(payload);
    } catch {
      throw new AppError(400, 'INVALID_ENCODING', 'Invalid UTF-16LE data.');
    }
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const payload = bytes.subarray(2);
    if (payload.length % 2 !== 0) {
      throw new AppError(400, 'INVALID_ENCODING', 'Invalid UTF-16 encoding: unexpected byte length.');
    }
    try {
      return new TextDecoder('utf-16be', { fatal: true }).decode(payload);
    } catch {
      throw new AppError(400, 'INVALID_ENCODING', 'Invalid UTF-16BE data.');
    }
  }

  // 2. Try standard UTF-8
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Fall through to other encodings
  }

  // 3. UTF-16 without BOM (check for alternating null bytes)
  if (bytes.length >= 4 && bytes.length % 2 === 0) {
    let evenZeros = 0;
    let oddZeros = 0;
    const sampleLimit = Math.min(bytes.length, 512);
    for (let i = 0; i < sampleLimit; i += 2) {
      if (bytes[i] === 0x00) evenZeros += 1;
      if (bytes[i + 1] === 0x00) oddZeros += 1;
    }
    if (oddZeros > sampleLimit / 8 && oddZeros > evenZeros * 2) {
      try {
        return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
      } catch {}
    } else if (evenZeros > sampleLimit / 8 && evenZeros > oddZeros * 2) {
      try {
        return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
      } catch {}
    }
  }

  // 4. Reject binary null bytes
  for (let i = 0; i < Math.min(bytes.length, 1024); i += 1) {
    if (bytes[i] === 0x00) {
      throw new AppError(
        400,
        'INVALID_ENCODING',
        'Could not parse CSV. Binary and non-text files are not supported.',
      );
    }
  }

  // 5. Try Windows-1252 / ISO-8859-1 (covers ANSI Excel and European legacy exports)
  try {
    return new TextDecoder('windows-1252', { fatal: true }).decode(bytes);
  } catch {
    throw new AppError(
      400,
      'INVALID_ENCODING',
      'The file encoding is not recognized. Please save as a standard CSV.',
    );
  }
}

function detectDelimiter(firstLine) {
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const character = firstLine[i];
    if (character === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (character === ',') commas += 1;
      else if (character === ';') semicolons += 1;
      else if (character === '\t') tabs += 1;
    }
  }
  if (semicolons > commas && semicolons >= tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

// Guard rejects malformed quoting that intentionally permissive parsers would otherwise accept.
function checkQuoting(text, delimiter = ',') {
  let state = 'start';
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (state === 'quoted') {
      if (character === '"') {
        if (text[i + 1] === '"') i += 1;
        else state = 'closed';
      }
    } else if (character === delimiter || character === '\r' || character === '\n') {
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
    throw new AppError(
      413,
      'FILE_TOO_LARGE',
      `CSV files must be ${Math.round(LIMITS.fileBytes / (1024 * 1024))} MiB or smaller.`,
    );

  const text = decodeCsvBytes(bytes);
  if (!text.trim())
    throw new AppError(
      400,
      'EMPTY_CSV',
      'The CSV is empty. Include a header and at least one data row.',
    );

  const firstLineEnd = text.search(/[\r\n]/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  checkQuoting(text, delimiter);
  const parser = dsvFormat(delimiter);
  const records = parser.parseRows(text, (row, index) => {
    if (index > LIMITS.rows)
      throw new AppError(
        413,
        'TOO_MANY_ROWS',
        `CSV files can contain at most ${LIMITS.rows.toLocaleString('en-US')} data rows.`,
      );
    if (row.length > LIMITS.columns)
      throw new AppError(
        413,
        'TOO_MANY_COLUMNS',
        `CSV files can contain at most ${LIMITS.columns} columns.`,
      );
    return row;
  });
  if (records.length < 2)
    throw new AppError(
      400,
      'NO_DATA_ROWS',
      'The CSV has no data rows. Include a header followed by at least one record.',
    );
  const seen = new Set();
  const headers = records[0].map((header, index) => {
    const trimmed = header.trim();
    if (trimmed.length === 0) {
      let name = `Column_${index + 1}`;
      let count = 1;
      while (seen.has(name)) {
        count += 1;
        name = `Column_${index + 1}_${count}`;
      }
      seen.add(name);
      return name;
    }
    seen.add(trimmed);
    return header;
  });
  return validateDataset({ headers, rows: records.slice(1) });
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
