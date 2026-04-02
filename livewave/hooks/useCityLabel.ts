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
