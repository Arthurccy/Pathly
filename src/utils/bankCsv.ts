import Papa from 'papaparse';
import type { CSVRow } from '../types/import';

function inferHeader(table: string[][]): string[] {
    const width = Math.max(...table.map(row => row.length));
    const sample = table.slice(0, 50);
    const dateRe = /^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{2,4})$/;
    const numRe = /^[-+]?\d[\d\s]*(?:[,.]\d+)?\s*(?:€|eur)?$/i;

    const kind = (col: number): 'date' | 'number' | 'text' | 'empty' => {
      const values = sample.map(row => row[col] || '').filter(Boolean);
      if (values.length === 0) return 'empty';
      const ratio = (re: RegExp) => values.filter(v => re.test(v)).length / values.length;
      if (ratio(dateRe) >= 0.7) return 'date';
      if (ratio(numRe) >= 0.7) return 'number';
      return 'text';
    };

    const kinds = Array.from({ length: width }, (_, i) => kind(i));
    const names: string[] = kinds.map((_, i) => `Colonne ${i + 1}`);

    const dateCols = kinds.map((k, i) => (k === 'date' ? i : -1)).filter(i => i >= 0);
    dateCols.forEach((col, n) => (names[col] = n === 0 ? 'Date' : 'Date de valeur'));

    const textCols = kinds.map((k, i) => (k === 'text' ? i : -1)).filter(i => i >= 0);
    if (textCols.length > 0) {
      const avg = (col: number) => sample.reduce((sum, row) => sum + (row[col] || '').length, 0) / sample.length;
      const best = textCols.reduce((a, b) => (avg(b) > avg(a) ? b : a));
      names[best] = 'Libellé';
    }

    const numCols = kinds.map((k, i) => (k === 'number' ? i : -1)).filter(i => i >= 0);
    const bothFilled = (a: number, b: number) => sample.some(row => row[a] && row[b]);
    if (numCols.length >= 3) {
      names[numCols[0]] = 'Débit';
      names[numCols[1]] = 'Crédit';
      names[numCols[numCols.length - 1]] = 'Solde';
    } else if (numCols.length === 2) {
      if (!bothFilled(numCols[0], numCols[1])) {
        names[numCols[0]] = 'Débit';
        names[numCols[1]] = 'Crédit';
      } else {
        names[numCols[0]] = 'Montant';
        names[numCols[1]] = 'Solde';
      }
    } else if (numCols.length === 1) {
      names[numCols[0]] = 'Montant';
    }
    return names;
  }


export function parseBankAmount(value?: string): number {
  if (!value) return NaN;
  const text = value.trim().replace(/^(?:EUR|€)\s*/i, '').replace(/\s*(?:EUR|€)$/i, '').replace(/[\u00a0\u202f]/g, ' ');
  const plain = /^[+-]?\d+(?:[.,]\d{1,2})?$/;
  const spaced = /^[+-]?\d{1,3}(?:[ '\u2019]\d{3})+(?:[.,]\d{1,2})?$/;
  const european = /^[+-]?\d{1,3}(?:\.\d{3})+,\d{1,2}$/;
  const american = /^[+-]?\d{1,3}(?:,\d{3})+\.\d{1,2}$/;
  let normalized: string;
  if (plain.test(text)) normalized = text.replace(',', '.');
  else if (spaced.test(text)) normalized = text.replace(/[ '\u2019]/g, '').replace(',', '.');
  else if (european.test(text)) normalized = text.replace(/\./g, '').replace(',', '.');
  else if (american.test(text)) normalized = text.replace(/,/g, '');
  else return NaN;
  const amount = Number(normalized);
  return Number.isFinite(amount) && Number.isSafeInteger(Math.round(amount * 100)) ? amount : NaN;
}

export function parseBankDate(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const french = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(text);
  if (!iso && !french) return null;
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [Number(french![3]), Number(french![2]), Number(french![1])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isHeader = (row: string[]) => {
  const names = row.map(normalize);
  return names.length >= 3 && names.some(h => /date|datum/.test(h)) &&
    names.some(h => !/date/.test(h) && /libelle|description|label|motif|intitule|detail|operation|payee|merchant/.test(h)) &&
    names.some(h => /montant|amount|debit|credit/.test(h));
};

export function parseBankCsv(text: string, hasHeader = true, separator?: string): CSVRow[] {
  const source = text.replace(/^\uFEFF/, '');
  const delimiters = separator ? [separator] : [';', '\t', ',', '|'];
  let table: string[][] | undefined;
  const lines = source.split(/\r\n|\n|\r/);
  // Inspect the actual header before parsing the body: bank preambles often use
  // different separators or contain dates and decimal balances.
  if (hasHeader) {
    for (let index = 0; index < Math.min(lines.length, 200) && !table; index++) {
      for (const delimiter of delimiters) {
        const candidate = Papa.parse<string[]>(lines[index], { delimiter, header: false }).data[0] || [];
        if (!isHeader(candidate)) continue;
        const result = Papa.parse<string[]>(lines.slice(index).join('\n'), { delimiter, header: false, skipEmptyLines: 'greedy' });
        if (result.errors.length) throw new Error('Le fichier contient des guillemets ou des lignes CSV mal formés. Réexportez le relevé depuis votre banque.');
        table = result.data; break;
      }
    }
    if (!table) throw new Error('Le tableau des opérations n’a pas été reconnu. Le CSV doit contenir des colonnes Date, Libellé et Montant (ou Débit / Crédit), après les informations du relevé. Vérifiez le format exporté par votre banque.');
  } else {
    for (const delimiter of delimiters) {
      const result = Papa.parse<string[]>(source, { delimiter, header: false, skipEmptyLines: 'greedy' });
      if (result.errors.length) continue;
      const header = inferHeader(result.data);
      if (header.includes('Date') && header.includes('Libellé') && header.some(h => ['Montant', 'Débit', 'Crédit'].includes(h))) {
        table = [header, ...result.data]; break;
      }
    }
    if (!table) throw new Error('Impossible d’identifier les colonnes du relevé sans en-tête. Utilisez un export CSV avec les noms des colonnes.');
  }
  const seen = new Map<string, number>();
  const header = table[0].map((cell, i) => {
    const name = cell.trim() || `Colonne ${i + 1}`;
    const count = (seen.get(name) || 0) + 1; seen.set(name, count);
    return count > 1 ? `${name} (${count})` : name;
  });
  const rows = table.slice(1).filter(row => row.filter(cell => cell.trim()).length >= 2).map(cells => {
    if (cells.length > header.length && cells.slice(header.length).some(cell => cell.trim())) {
      throw new Error('Une ligne contient plus de colonnes que l’en-tête. Vérifiez le séparateur et les guillemets du CSV.');
    }
    return Object.fromEntries(header.map((name, i) => [name, (cells[i] || '').trim()])) as CSVRow;
  });
  const debit = header.find(h => /^debit/.test(normalize(h)));
  const credit = header.find(h => /^credit/.test(normalize(h)));
  if ((debit || credit) && !header.some(h => /montant|amount/.test(normalize(h)))) {
    for (const row of rows) {
      const d = debit && row[debit] ? parseBankAmount(row[debit]) : 0;
      const c = credit && row[credit] ? parseBankAmount(row[credit]) : 0;
      row.Montant = (!(debit && row[debit]) && !(credit && row[credit])) ? '' : Number.isFinite(d) && Number.isFinite(c) ? (Math.abs(c) - Math.abs(d)).toFixed(2) : 'Montant invalide';
    }
  }
  if (rows.length === 0) throw new Error('Le tableau ne contient aucune opération.');
  return rows;
}
