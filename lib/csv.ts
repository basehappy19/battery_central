// Minimal CSV serialization helper (Feature 3). No external dependency needed
// for a simple flat rows -> CSV text conversion.

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0 && !columns) return '';
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const header = cols.map(escapeCsvValue).join(',');
  const lines = rows.map((row) => cols.map((c) => escapeCsvValue(row[c])).join(','));
  // Prefix with UTF-8 BOM so Excel opens Thai text correctly.
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}
