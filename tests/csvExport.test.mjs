import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { serializeCsv } from '../src/utils/csvExport.ts';

const decode = csv => Papa.parse(csv, { skipEmptyLines: false }).data;

test('CSV quoting preserves financial descriptions and prevents extra rows or cells', () => {
  const rows = [
    ['Date', 'Description', 'Amount', 'Category', 'Account'],
    ['2026-11-12', 'Achat "livre", boulangerie\nParis', 25.3, 'Courses, cadeaux', 'Compte "courant"'],
    ['2026-11-13', 'Texte\r\navec deux lignes', -12.5, null, undefined],
  ];
  const csv = serializeCsv(rows);
  assert.deepEqual(decode(csv), [
    rows[0],
    ['2026-11-12', rows[1][1], '25.3', rows[1][3], rows[1][4]],
    ['2026-11-13', rows[2][1], '-12.5', '', ''],
  ]);
});

test('untrusted descriptions and names cannot become spreadsheet formulas', () => {
  const formulas = [
    '=HYPERLINK("https://example.invalid", "click")', '+SUM(1,2)', '-1+1', '@SUM(A1)',
    '   =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '\uFEFF=1+1', '＝1+1', '＋1', '－1', '＠SUM(A1)',
  ];
  for (const formula of formulas) {
    const decoded = decode(serializeCsv([['Description', 'Account'], [formula, formula]]));
    assert.deepEqual(decoded[1], [`'${formula}`, `'${formula}`]);
  }
});

test('trusted numeric amounts remain numbers while numeric-looking user text is protected', () => {
  assert.deepEqual(decode(serializeCsv([[-12.5, 0, 42, '-12.5', '+42', true, 'Ordinaire', "'already text"]])), [
    ['-12.5', '0', '42', "'-12.5", "'+42", 'true', 'Ordinaire', "'already text"],
  ]);
  for (const amount of [NaN, Infinity, -Infinity]) assert.throws(() => serializeCsv([[amount]]), TypeError);
});
