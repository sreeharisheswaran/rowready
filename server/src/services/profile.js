import { isFormulaRisk } from './csv.js';

export const isMissing = (value) => value.trim() === '';
export const rowKey = (row) => JSON.stringify(row);
const percentage = (part, whole) => (whole === 0 ? 0 : Number(((part * 100) / whole).toFixed(2)));

export function inferValueType(value) {
  const text = value.trim();
  if (!text) return 'empty';
  if (/^(true|false)$/i.test(text)) return 'boolean';
  if (/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) {
    const number = Number(text);
    if (Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)))
      return 'number';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`);
    if (!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === text) return 'date';
  }
  return 'string';
}

export function profileDataset({ headers, rows }) {
  const rowCount = rows.length;
  const columnCount = headers.length;
  const cellCount = rowCount * columnCount;
  let missingCells = 0;
  let whitespaceCells = 0;
  let formulaCells = headers.filter(isFormulaRisk).length;
  const columns = headers.map((name, index) => {
    let missing = 0;
    let whitespace = 0;
    const unique = new Set();
    const typeCounts = { number: 0, boolean: 0, date: 0, string: 0 };
    let minimum = Infinity;
    let maximum = -Infinity;
    let sum = 0;
    for (const row of rows) {
      const value = row[index];
      if (value !== value.trim()) whitespace += 1;
      if (isFormulaRisk(value)) formulaCells += 1;
      const type = inferValueType(value);
      if (type === 'empty') {
        missing += 1;
        continue;
      }
      unique.add(value);
      typeCounts[type] += 1;
      if (type === 'number') {
        const number = Number(value.trim());
        minimum = Math.min(minimum, number);
        maximum = Math.max(maximum, number);
        sum += number;
      }
    }
    missingCells += missing;
    whitespaceCells += whitespace;
    const types = Object.keys(typeCounts).filter((type) => typeCounts[type] > 0);
    const inferredType = types.length === 0 ? 'empty' : types.length === 1 ? types[0] : 'mixed';
    return {
      name,
      index,
      inferredType,
      missing,
      missingPercentage: percentage(missing, rowCount),
      whitespace,
      uniqueValues: unique.size,
      typeCounts,
      numeric:
        inferredType === 'number'
          ? { min: minimum, max: maximum, mean: sum / typeCounts.number }
          : null,
    };
  });
  const duplicateRows = rows.length - new Set(rows.map(rowKey)).size;
  const mixedColumns = columns.filter((column) => column.inferredType === 'mixed').length;
  const whitespaceHeaders = headers.filter((value) => value !== value.trim()).length;
  const warnings = [
    {
      code: 'MISSING_VALUES',
      count: missingCells,
      message: `${missingCells} missing cells remain. Review these values at the source; RowReady does not fill them automatically.`,
    },
    {
      code: 'DUPLICATE_ROWS',
      count: duplicateRows,
      message: `${duplicateRows} exact duplicate rows can be removed, keeping the first occurrence.`,
    },
    {
      code: 'WHITESPACE',
      count: whitespaceCells,
      message: `${whitespaceCells} cells have leading or trailing whitespace.`,
    },
    {
      code: 'MIXED_TYPES',
      count: mixedColumns,
      message: `${mixedColumns} columns contain mixed inferred types. Review the source; values are never coerced.`,
    },
    {
      code: 'FORMULA_RISK',
      count: formulaCells,
      message: `${formulaCells} cells or headers may be interpreted as spreadsheet formulas. Safe export prefixes these with an apostrophe.`,
    },
    {
      code: 'HEADER_WHITESPACE',
      count: whitespaceHeaders,
      message: `${whitespaceHeaders} headers have surrounding whitespace. Headers are preserved; rename them in your source if needed.`,
    },
  ].filter((warning) => warning.count > 0);
  return {
    rowCount,
    columnCount,
    cellCount,
    missingCells,
    missingPercentage: percentage(missingCells, cellCount),
    duplicateRows,
    duplicatePercentage: percentage(duplicateRows, rowCount),
    whitespaceCells,
    formulaCells,
    mixedColumns,
    whitespaceHeaders,
    columns,
    warnings,
  };
}
