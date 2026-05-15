/**
 * Deriva un nombre de ciudad legible a partir de coordenadas GPS
 * usando bounding boxes conocidas. Devuelve "Near you" si no reconoce la ubicación.
 */
export function getCityLabel(lat: number, lng: number): string {
  // España
  if (lat > 41.2 && lat < 41.6 && lng > 1.9 && lng < 2.4) return 'Barcelona'
  if (lat > 40.2 && lat < 40.7 && lng > -3.9 && lng < -3.4) return 'Madrid'
  if (lat > 37.3 && lat < 37.5 && lng > -6.1 && lng < -5.8) return 'Sevilla'
  if (lat > 39.3 && lat < 39.6 && lng > -0.5 && lng < -0.2) return 'Valencia'
  if (lat > 43.2 && lat < 43.4 && lng > -2.9 && lng < -2.7) return 'Bilbao'
  if (lat > 36.6 && lat < 36.9 && lng > -4.6 && lng < -4.3) return 'Málaga'
  if (lat > 41.6 && lat < 41.8 && lng > 2.7 && lng < 3.0) return 'Girona'
  // España genérico
  if (lat > 36.0 && lat < 44.0 && lng > -9.5 && lng < 4.5) return 'España'
  // Europa
  if (lat > 48.7 && lat < 48.95 && lng > 2.2 && lng < 2.5) return 'Paris'
  if (lat > 51.4 && lat < 51.6 && lng > -0.2 && lng < 0.1) return 'London'
  if (lat > 52.4 && lat < 52.6 && lng > 13.2 && lng < 13.6) return 'Berlin'
  return 'Near you'
}

/**
 * Deriva el nombre del país a partir de coordenadas GPS
 * usando bounding boxes de países. Muestra el país del usuario
 * en vez de la ciudad para mejor contexto.
 * Devuelve "Near you" si no reconoce la ubicación.
 */
export function getCountryLabel(lat: number, lng: number): string {
  // Portugal DEBE ir antes que España (sus coords solapan con España)
  if (lat > 36.9 && lat < 42.2 && lng > -9.5 && lng < -6.2) return 'Portugal'
  // España (incluyendo Canarias y Baleares)
  if (lat > 36.0 && lat < 43.8 && lng > -9.5 && lng < 4.5) return 'España'
  // Irlanda DEBE ir antes que Reino Unido
  if (lat > 51.4 && lat < 55.4 && lng > -10.5 && lng < -5.9) return 'Irlanda'
  // Reino Unido
  if (lat > 49.9 && lat < 60.8 && lng > -8.6 && lng < 1.8) return 'Reino Unido'
  // Francia
  if (lat > 42.3 && lat < 51.1 && lng > -5.2 && lng < 8.2) return 'Francia'
  // Alemania
  if (lat > 47.3 && lat < 55.1 && lng > 5.9 && lng < 15.0) return 'Alemania'
  // Italia
  if (lat > 36.0 && lat < 47.1 && lng > 6.6 && lng < 18.5) return 'Italia'
  // Países Bajos
  if (lat > 50.7 && lat < 53.6 && lng > 3.2 && lng < 7.2) return 'Países Bajos'
  // Bélgica
  if (lat > 49.5 && lat < 51.5 && lng > 2.5 && lng < 6.4) return 'Bélgica'
  // Suiza
  if (lat > 45.8 && lat < 47.8 && lng > 5.9 && lng < 10.5) return 'Suiza'
  // Austria
  if (lat > 46.3 && lat < 49.0 && lng > 9.5 && lng < 17.2) return 'Austria'
  // Fallback
  return 'Near you'
}

/**
 * Returns the ISO 3166-1 alpha-2 country code for given coordinates.
 * Uses the same bounding boxes as getCountryLabel().
 * Priority: Portugal (PT) before Spain (ES), Ireland (IE) before UK (GB).
 * Returns null for coordinates outside known bounds.
 */
export function getCountryCode(lat: number, lng: number): string | null {
  // Portugal DEBE ir antes que España (sus coords solapan con España)
  if (lat > 36.9 && lat < 42.2 && lng > -9.5 && lng < -6.2) return 'PT'
  // España (incluyendo Canarias y Baleares)
  if (lat > 36.0 && lat < 43.8 && lng > -9.5 && lng < 4.5) return 'ES'
  // Irlanda DEBE ir antes que Reino Unido
  if (lat > 51.4 && lat < 55.4 && lng > -10.5 && lng < -5.9) return 'IE'
  // Reino Unido
  if (lat > 49.9 && lat < 60.8 && lng > -8.6 && lng < 1.8) return 'GB'
  // Francia
  if (lat > 42.3 && lat < 51.1 && lng > -5.2 && lng < 8.2) return 'FR'
  // Alemania
  if (lat > 47.3 && lat < 55.1 && lng > 5.9 && lng < 15.0) return 'DE'
  // Italia
  if (lat > 36.0 && lat < 47.1 && lng > 6.6 && lng < 18.5) return 'IT'
  // Países Bajos
  if (lat > 50.7 && lat < 53.6 && lng > 3.2 && lng < 7.2) return 'NL'
  // Bélgica
  if (lat > 49.5 && lat < 51.5 && lng > 2.5 && lng < 6.4) return 'BE'
  // Suiza
  if (lat > 45.8 && lat < 47.8 && lng > 5.9 && lng < 10.5) return 'CH'
  // Austria
  if (lat > 46.3 && lat < 49.0 && lng > 9.5 && lng < 17.2) return 'AT'
  // Fallback
  return null
}
