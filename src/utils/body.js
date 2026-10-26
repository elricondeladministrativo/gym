/** Cálculos corporales. */

export function calcIMC(pesoKg, estaturaCm) {
  if (!pesoKg || !estaturaCm) return null;
  const metros = estaturaCm / 100;
  return pesoKg / (metros * metros);
}

export function imcCategory(imc) {
  if (imc == null || Number.isNaN(imc)) {
    return { label: 'Sin datos', tone: 'muted' };
  }
  if (imc < 18.5) return { label: 'Bajo peso', tone: 'steel' };
  if (imc < 25) return { label: 'Normal', tone: 'success' };
  if (imc < 30) return { label: 'Sobrepeso', tone: 'accent' };
  return { label: 'Obesidad', tone: 'danger' };
}

export function formatNumber(value, decimals = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value)
    .toFixed(decimals)
    .replace('.', ',')
    .replace(/,0$/, '');
}

export function formatDelta(value, decimals = 1) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (Math.abs(n) < 0.05) return 'sin cambios';
  return `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n), decimals)}`;
}
