/**
 * Utilidades de fecha. Trabajamos con fechas locales en formato YYYY-MM-DD
 * para que el "día" coincida con el calendario del usuario, sin corrimientos UTC.
 */

export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isoDaysAgo(days) {
  return toISODate(addDays(new Date(), -days));
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "lunes, 25 de octubre" */
export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/** Deja solo la primera letra en mayúscula (fechas en español). */
export function capitalizeFirst(value = '') {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "25 oct" */
export function formatShortDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(parseISODate(iso));
}

/** "25/10" para ejes de gráficos */
export function formatChartDate(iso) {
  const date = parseISODate(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`;
}

export function daysBetween(isoFrom, isoTo) {
  return Math.round(
    (parseISODate(isoTo).getTime() - parseISODate(isoFrom).getTime()) /
      86400000
  );
}
