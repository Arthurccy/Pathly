export type CsvCell = string | number | boolean | null | undefined;

/**
 * Quote every field so commas, quotes and embedded newlines cannot create cells.
 * Spreadsheet formula markers in text are prefixed with an apostrophe. Numbers
 * remain numeric, including negative amounts; callers must pass amounts as numbers.
 */
export function serializeCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map(row => row.map(value => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('CSV amounts must be finite numbers');
    }
    let text = value == null ? '' : String(value);
    if (typeof value === 'string' && (/^\s*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/u.test(text))) {
      text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
