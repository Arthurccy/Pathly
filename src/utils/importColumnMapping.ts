import type { ColumnMapping, CSVRow } from '../types/import';

const normalize = (header: string) => header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function autoMapBankColumns(rows: CSVRow[]): ColumnMapping {
  const headers = Object.keys(rows[0] || {});
  const find = (pattern: RegExp, eligible = headers) => eligible.find(header => pattern.test(normalize(header))) || '';
  const date = find(/date|datum/);
  const descriptionHeaders = headers.filter(header => !/date|datum/.test(normalize(header)));
  return {
    date,
    description: find(/desc|libelle|label|motif|intitule|payee|merchant/, descriptionHeaders) || find(/operation|detail/, descriptionHeaders),
    amount: find(/^montant|^amount/) || find(/montant|amount|debit|credit/),
    account: find(/compte|account/, headers.filter(header => !/solde|balance/.test(normalize(header)))),
    category: find(/categorie|category/),
    balance: find(/solde|balance/),
  };
}

export function bankMappingErrors(mapping: ColumnMapping, headers: string[]): string[] {
  const errors: string[] = [];
  const fields = [ ['date', 'Date'], ['description', 'Description (libellé)'], ['amount', 'Montant'] ] as const;
  for (const [key, label] of fields) {
    if (!mapping[key] || !headers.includes(mapping[key])) errors.push(`Choisissez une colonne pour « ${label} ».`);
  }
  const selected = fields.map(([key]) => mapping[key]).filter(Boolean);
  if (new Set(selected).size !== selected.length) {
    errors.push('Date, Description et Montant doivent utiliser trois colonnes différentes. Pour la description, choisissez « Libellé », pas « Date d’opération ».');
  }
  if (mapping.balance && (selected.includes(mapping.balance) || /^(debit|credit)\b/.test(normalize(mapping.balance)))) {
    errors.push('Le solde du compte ne correspond pas au montant d’une opération, au débit ou au crédit. Choisissez une vraie colonne de solde, ou laissez « Ignorer » si le relevé n’en contient pas.');
  }
  return errors;
}
