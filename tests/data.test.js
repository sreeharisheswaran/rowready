import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, serializeCsv, isFormulaRisk } from '../server/src/services/csv.js';
import { profileDataset, inferValueType } from '../server/src/services/profile.js';
import { cleanDataset } from '../server/src/services/clean.js';
import { safeFilename, validateDataset } from '../server/src/services/dataset.js';
import { LIMITS } from '../shared/limits.js';
import { readFileSync } from 'node:fs';

const parse = (text) => parseCsv(Buffer.from(text));

test('ordinary CSV yields actual dimensions, inferred types, and statistics', () => {
  const profile = profileDataset(
    parse('name,age,active,date\nAna,20,true,2026-10-25\nBo,30,false,2026-10-26'),
  );
  assert.equal(profile.rowCount, 2);
  assert.equal(profile.columnCount, 4);
  assert.equal(profile.missingCells, 0);
  assert.deepEqual(
    profile.columns.map((column) => column.inferredType),
    ['string', 'number', 'boolean', 'date'],
  );
  assert.deepEqual(profile.columns[1].numeric, { min: 20, max: 30, mean: 25 });
});

test('quoted commas, escaped quotes, multiline fields, BOM and CRLF are parsed', () => {
  const dataset = parse('\ufeffname,note\r\n"Doe, Jane","Said ""hello""\nnext line"\r\n');
  assert.deepEqual(dataset, {
    headers: ['name', 'note'],
    rows: [['Doe, Jane', 'Said "hello"\nnext line']],
  });
});

test('UTF-16 LE/BE, Windows-1252, semicolon and tab CSV formats are supported', () => {
  // UTF-16 LE with BOM
  const utf16le = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('city,population\r\nTokyo,37400000\r\nDelhi,29300000\r\n', 'utf16le'),
  ]);
  const parsedLe = parseCsv(utf16le);
  assert.deepEqual(parsedLe.headers, ['city', 'population']);
  assert.equal(parsedLe.rows.length, 2);

  // UTF-16 BE with BOM
  const bePayload = Buffer.from('city,population\r\nTokyo,37400000\r\n', 'utf16le');
  bePayload.swap16();
  const utf16be = Buffer.concat([Buffer.from([0xfe, 0xff]), bePayload]);
  const parsedBe = parseCsv(utf16be);
  assert.deepEqual(parsedBe.headers, ['city', 'population']);
  assert.equal(parsedBe.rows.length, 1);

  // Windows-1252 / ISO-8859-1 with accented characters
  const latin1 = Buffer.from('name,city\r\nRen\xe9,Montr\xe9al\r\n', 'binary');
  const parsedLatin1 = parseCsv(latin1);
  assert.deepEqual(parsedLatin1.headers, ['name', 'city']);
  assert.deepEqual(parsedLatin1.rows, [['René', 'Montréal']]);

  // Semicolon-delimited CSV (European Excel style)
  const semi = parse('name;score;status\r\nAlice;95;active\r\nBob;80;pending\r\n');
  assert.deepEqual(semi.headers, ['name', 'score', 'status']);
  assert.equal(semi.rows.length, 2);

  // Tab-delimited CSV (TSV)
  const tsv = parse('id\tname\tage\r\n1\tCharlie\t32\r\n');
  assert.deepEqual(tsv.headers, ['id', 'name', 'age']);
  assert.equal(tsv.rows.length, 1);
});

test('missing cells include whitespace but exclude literal NA, null, and zero', () => {
  const profile = profileDataset(parse('a,b,c\n, ,NA\nnull,0,""'));
  assert.equal(profile.missingCells, 3);
  assert.equal(profile.missingPercentage, 50);
  assert.equal(profile.columns[0].missing, 1);
  assert.equal(profile.columns[1].missing, 1);
});

test('duplicates compare complete parsed rows, preserve order, and are case/space sensitive', () => {
  const dataset = parse('a,b\n1,x\n1,x\n1, x\n1,X\n"1","x"');
  assert.equal(profileDataset(dataset).duplicateRows, 2);
  const result = cleanDataset(dataset, ['deduplicate']);
  assert.equal(result.changes.removedRows, 2);
  assert.deepEqual(result.dataset.rows, [
    ['1', 'x'],
    ['1', ' x'],
    ['1', 'X'],
  ]);
});

test('trimming only changes surrounding whitespace, leaving headers and original untouched', () => {
  const original = {
    headers: [' id ', 'note'],
    rows: [
      [' 001 ', ' two  words \n'],
      ['0', ' no '],
    ],
  };
  const copy = structuredClone(original);
  const result = cleanDataset(original, ['trim']);
  assert.equal(result.changes.trimmedCells, 3);
  assert.deepEqual(result.dataset.rows, [
    ['001', 'two  words'],
    ['0', 'no'],
  ]);
  assert.deepEqual(result.dataset.headers, original.headers);
  assert.deepEqual(original, copy);
});

test('combined operations always trim then deduplicate and are idempotent', () => {
  const dataset = parse('name\n Ana \nAna\nBo');
  const cleaned = cleanDataset(dataset, ['deduplicate', 'trim']);
  assert.deepEqual(cleaned.changes, { trimmedCells: 1, removedRows: 1 });
  assert.deepEqual(cleaned.dataset.rows, [['Ana'], ['Bo']]);
  assert.deepEqual(cleanDataset(cleaned.dataset, ['trim', 'deduplicate']).changes, {
    trimmedCells: 0,
    removedRows: 0,
  });
});

test('serialization round-trips commas, quotes, CR/LF, empty values, Unicode and whitespace', () => {
  const dataset = {
    headers: ['a', 'b'],
    rows: [
      ['a,b', 'say "hi"'],
      ['line\r\nnext', ''],
      ['தமிழ்', ' x '],
    ],
  };
  assert.deepEqual(parse(serializeCsv(dataset).csv), dataset);
});

test('safe export protects headers and formulas without mutating working data', () => {
  const dataset = {
    headers: ['=header'],
    rows: [['=1+1'], ['  @SUM(A1)'], ['-10'], ['\ttext'], ['safe'], ['＋1']],
  };
  const result = serializeCsv(dataset);
  assert.equal(result.escapedCells, 6);
  assert.deepEqual(parse(result.csv).rows, [
    ["'=1+1"],
    ["'  @SUM(A1)"],
    ["'-10"],
    ["'\ttext"],
    ['safe'],
    ["'＋1"],
  ]);
  assert.equal(dataset.rows[0][0], '=1+1');
  assert.equal(isFormulaRisk('hello-world'), false);
  assert.deepEqual(parse(serializeCsv(dataset, { spreadsheetSafe: false }).csv), dataset);
});

test('malformed quotes, inconsistent rows and blank records fail usefully', () => {
  for (const text of ['a,b\n"unclosed,x', 'a,b\na"b,c', 'a,b\n"a" trailing,b'])
    assert.throws(() => parse(text), { code: 'MALFORMED_CSV' });
  for (const text of ['a,b\nx', 'a,b\nx,y,z', 'a,b\n\nx,y'])
    assert.throws(() => parse(text), { code: 'INCONSISTENT_ROWS' });
});

test('empty, header-only, binary, bad encoding and excessive input are rejected', () => {
  for (const text of ['', ' \r\n']) assert.throws(() => parse(text), { code: 'EMPTY_CSV' });
  assert.throws(() => parse('a,b\n'), { code: 'NO_DATA_ROWS' });
  assert.throws(() => parse('a\nx\0'), { code: 'INVALID_DATASET' });
  assert.throws(() => parseCsv(Buffer.from([0xff, 0xfe, 0x00])), { code: 'INVALID_ENCODING' });
  assert.throws(() => parseCsv(Buffer.alloc(LIMITS.fileBytes + 1, 'x')), { status: 413 });
  assert.throws(() => parse('a\n' + 'x\n'.repeat(LIMITS.rows + 1)), { code: 'TOO_MANY_ROWS' });
  assert.throws(
    () =>
      parse(
        Array.from({ length: LIMITS.columns + 1 }, (_, i) => `c${i}`).join(',') +
          '\n' +
          'x,'.repeat(LIMITS.columns) +
          'x',
      ),
    { code: 'TOO_MANY_COLUMNS' },
  );
  assert.throws(() => parse('a\n' + 'x'.repeat(LIMITS.cellCharacters + 1)), {
    code: 'INVALID_DATASET',
  });
});

test('header and structural limits also apply to client-supplied datasets', () => {
  for (const text of ['a,a\nx,y', ' a,a \nx,y'])
    assert.throws(() => parse(text), { code: 'DUPLICATE_HEADERS' });
  assert.throws(() => parse('a, \nx,y'), { code: 'INVALID_DATASET' });
  assert.throws(() => validateDataset({ headers: ['a'], rows: [[42]] }), {
    code: 'INVALID_DATASET',
  });
  assert.throws(
    () =>
      validateDataset({
        headers: Array.from({ length: LIMITS.columns }, (_, i) => `${i}`),
        rows: Array.from({ length: Math.floor(LIMITS.cells / LIMITS.columns) + 1 }, () =>
          Array(LIMITS.columns).fill(''),
        ),
      }),
    { code: 'DATASET_TOO_LARGE' },
  );
  assert.throws(
    () =>
      validateDataset({
        headers: ['a'],
        rows: Array.from(
          { length: Math.ceil((LIMITS.datasetBytes + 1000) / 12000) },
          () => ['x'.repeat(12000)],
        ),
      }),
    { code: 'DATASET_TOO_LARGE' },
  );
});

test('unsupported, repeated, empty and non-array operations fail', () => {
  for (const operations of [[], ['execute'], ['trim', 'trim'], 'trim', ['deduplicate', 'fill']])
    assert.throws(() => cleanDataset(parse('a\nx'), operations), { code: 'INVALID_REQUEST' });
});

test('type inference is conservative, handles mixed/empty columns and never coerces identifiers', () => {
  for (const value of ['001', '2026-02-30', 'NaN', 'Infinity', '9007199254740993', '1e309'])
    assert.equal(inferValueType(value), 'string');
  assert.equal(inferValueType('2024-02-29'), 'date');
  const profile = profileDataset(parse('a,b\n1,\nword," "'));
  assert.deepEqual(
    profile.columns.map((column) => column.inferredType),
    ['mixed', 'empty'],
  );
  assert.equal(profile.columns[0].numeric, null);
  assert.equal(profile.mixedColumns, 1);
});

test('filenames strip path segments and unsafe characters; unsupported extensions fail', () => {
  assert.equal(safeFilename('../../some<file>.csv'), 'some_file_.csv');
  assert.equal(safeFilename('C:\\temp\\data.csv'), 'data.csv');
  assert.equal(safeFilename('x'.repeat(300) + '.csv').length, LIMITS.filenameCharacters);
  assert.throws(() => safeFilename('data.xlsx'), { code: 'INVALID_FILENAME' });
});

test('prepared demo has documented metrics before and after cleaning', () => {
  const dataset = parseCsv(readFileSync('client/public/sample.csv'));
  const before = profileDataset(dataset);
  assert.deepEqual(
    [
      before.rowCount,
      before.columnCount,
      before.missingCells,
      before.missingPercentage,
      before.duplicateRows,
      before.whitespaceCells,
    ],
    [9, 7, 2, 3.17, 1, 5],
  );
  const result = cleanDataset(dataset, ['trim', 'deduplicate']);
  assert.deepEqual(result.changes, { trimmedCells: 5, removedRows: 2 });
  const after = profileDataset(result.dataset);
  assert.deepEqual(
    [
      after.rowCount,
      after.missingCells,
      after.missingPercentage,
      after.duplicateRows,
      after.whitespaceCells,
      after.mixedColumns,
      after.formulaCells,
    ],
    [7, 2, 4.08, 0, 0, 1, 1],
  );
  assert.equal(after.warnings.length, 3);
});

test('CSV serialization uses CRLF record boundaries without changing embedded newlines', () => {
  const dataset = { headers: ['text'], rows: [['first\nsecond'], ['last']] };
  assert.equal(serializeCsv(dataset).csv, 'text\r\n"first\nsecond"\r\nlast\r\n');
});
