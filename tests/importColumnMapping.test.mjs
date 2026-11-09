import test from 'node:test';
import assert from 'node:assert/strict';
import { autoMapBankColumns, bankMappingErrors } from '../src/utils/importColumnMapping.ts';
import { parseBankCsv } from '../src/utils/bankCsv.ts';

const rows = parseBankCsv('Date d’opération;Libellé;Débit euros;Crédit euros;\n05/11/2026;Virement reçu;;50,00;');
const headers = Object.keys(rows[0]);

test('maps the bank export from the screenshot to distinct required columns', () => {
  const mapping = autoMapBankColumns(rows);
  assert.equal(mapping.date, 'Date d’opération');
  assert.equal(mapping.description, 'Libellé');
  assert.equal(mapping.amount, 'Montant');
  assert.equal(mapping.balance, '');
  assert.deepEqual(bankMappingErrors(mapping, headers), []);
});

test('date-of-operation is never used as the description, regardless of header order', () => {
  const mapping = autoMapBankColumns([{ 'DATE D’OPÉRATION': '', 'Date valeur': '', 'Crédit euros': '', 'LIBELLÉ': '', Montant: '' }]);
  assert.equal(mapping.description, 'LIBELLÉ');
  assert.equal(mapping.amount, 'Montant');
});

test('explains both blockers from the screenshot and clears them when corrected', () => {
  const mapping = { ...autoMapBankColumns(rows), description: 'Date d’opération', balance: 'Débit euros' };
  const errors = bankMappingErrors(mapping, headers);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Libellé/);
  assert.match(errors[1], /Ignorer/);
  assert.deepEqual(bankMappingErrors({ ...mapping, description: 'Libellé', balance: '' }, headers), []);
});

test('missing description is explicit, and a real balance column remains available', () => {
  const noDescription = [{ Date: '', Montant: '', Solde: '' }];
  const mapping = autoMapBankColumns(noDescription);
  assert.equal(mapping.description, '');
  assert.equal(mapping.balance, 'Solde');
  assert.equal(bankMappingErrors(mapping, Object.keys(noDescription[0])).length, 1);
});
