export function parseSignedAmount(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^[+-]?\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}
