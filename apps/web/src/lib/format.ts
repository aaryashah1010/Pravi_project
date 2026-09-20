import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

const NBSP = ' ';

/** Display-only INR formatting: crore / lakh shorthand. The API keeps money as decimal strings. */
export function formatInr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (abs >= 1e7) return `₹${(n / 1e7).toLocaleString('en-IN', one)}${NBSP}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toLocaleString('en-IN', one)}${NBSP}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatInrFull(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

export function formatDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, 'dd MMM yyyy') : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, 'dd MMM yyyy, HH:mm') : '—';
}

export function formatTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, 'HH:mm:ss') : '—';
}

export function relativeTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return '—';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** "in 3 days" / "2 days overdue" style helper for due dates. */
export function dueLabel(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return 'No due date';
  const rel = formatDistanceToNowStrict(d, { unit: 'day', roundingMethod: 'floor' });
  return d.getTime() < Date.now() ? `${rel} overdue` : `due in ${rel}`;
}

export function days(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n}d`;
}

export function humanize(code: string | null | undefined): string {
  if (!code) return '—';
  const s = code.replace(/[._]+/g, ' ').toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${Math.round(n * 10) / 10}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
