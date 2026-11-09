import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankCsv, parseBankAmount, parseBankDate } from '../src/utils/bankCsv.ts';

const bankExport = '\uFEFFTéléchargement du 09/11/2026;\nSolde au 09/11/2026;272,22\n\nDate;Libellé;Débit euros;Crédit euros;Solde;Identifiant\n09/11/2026;Intérêts débiteurs - Période : 10/2026 TAEG=16;4,80;;272,22;deadbeef0123456789abcdef\n08/11/2026;Salaire;;1 800,00;277,02;abc123';

test('finds the real header after bank metadata and preserves decimal commas', () => {
  const rows = parseBankCsv(bankExport);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Date, '09/11/2026');
  assert.equal(rows[0].Montant, '-4.80');
  assert.equal(parseBankAmount(rows[0].Solde), 272.22);
  assert.equal(rows[1].Montant, '1800.00');
});

test('never converts dates, metadata or identifiers into money', () => {
  for (const value of ['Solde au 09/11/2026 272', '09/11/2026', 'deadbeef0123456789abcdef;48', 'Intérêts débiteurs - Période : 10/2026 TAEG=16', '1.133179752484554e+23', '99999999999999999999', '12,3456', '2026 272,22']) assert.ok(Number.isNaN(parseBankAmount(value)), value);
  assert.throws(() => parseBankCsv('Téléchargement du 09/11/2026;\nSolde au 09/11/2026;272,22\nIntérêts débiteurs - Période : 10/2026 TAEG=16;48'), /pas été reconnu/);
});

test('recognizes common currency and grouping formats without stripping arbitrary text', () => {
  for (const value of ['1 234,56', '1\u202f234,56 €', '1.234,56', '1,234.56', 'EUR 1234.56']) assert.equal(parseBankAmount(value), 1234.56);
  assert.equal(parseBankAmount('-272,22'), -272.22);
  assert.equal(parseBankAmount('0'), 0);
});

test('supports quoted commas and multi-line descriptions', () => {
  const rows = parseBankCsv('Date,Description,Amount\n2026-11-09,"Restaurant, Paris\nrepas",-20.50');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Description, 'Restaurant, Paris\nrepas');
  assert.equal(parseBankAmount(rows[0].Amount), -20.5);
});

test('rejects extra nonempty columns instead of shifting amount fields', () => {
  assert.throws(() => parseBankCsv('Date;Libellé;Montant\n09/11/2026;Achat;texte;-100'), /plus de colonnes/);
});

test('a debit-only export stays an expense, and malformed debit is rejected', () => {
  assert.equal(parseBankCsv('Date;Libellé;Débit\n09/11/2026;Achat;20,50')[0].Montant, '-20.50');
  assert.ok(Number.isNaN(parseBankAmount(parseBankCsv('Date;Libellé;Débit;Crédit\n09/11/2026;Achat;réf123;')[0].Montant)));
});

test('validates calendar dates including French days starting with 20', () => {
  assert.equal(parseBankDate('20-11-2026').getDate(), 20);
  assert.equal(parseBankDate('2026-11-09').getMonth(), 10);
  assert.equal(parseBankDate('31/02/2026'), null);
  assert.equal(parseBankDate('29/02/2024').getDate(), 29);
});
