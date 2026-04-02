const NOISE_SUBSTRINGS = [
  'abono', 'entrada', 'festival', 'agosto', 'julio', 'junio', 'mayo',
  'octubre', 'noviembre', 'diciembre', 'enero', 'febrero', 'marzo', 'abril',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'cookie', 'privacy', 'política', 'política de', 'aviso legal',
  'ver más', 'comprar', 'venta', 'descuento', 'precio',
];
const isNoise = (name) => {
  const lower = name.toLowerCase().trim();
  if (lower.length > 40) return true;
  if (/[;]/.test(lower)) return true;
  if ((lower.match(/,/g) || []).length > 2) return true;
  if (NOISE_SUBSTRINGS.some(s => lower.includes(s))) return true;
  return false;
};
console.log(isNoise('Low Festival 2026. Abonos'));
console.log(isNoise('Featured artists'));
console.log(isNoise('static-context'));
