import { getCityLabel } from '../useCityLabel'

describe('getCityLabel', () => {
  describe('ciudades españolas', () => {
    it('devuelve Barcelona para coordenadas de Barcelona', () => {
      expect(getCityLabel(41.38, 2.17)).toBe('Barcelona')
    })

    it('devuelve Madrid para coordenadas de Madrid', () => {
      expect(getCityLabel(40.42, -3.70)).toBe('Madrid')
    })

    it('devuelve Sevilla para coordenadas de Sevilla', () => {
      expect(getCityLabel(37.39, -5.99)).toBe('Sevilla')
    })

    it('devuelve Valencia para coordenadas de Valencia', () => {
      expect(getCityLabel(39.47, -0.38)).toBe('Valencia')
    })

    it('devuelve Bilbao para coordenadas de Bilbao', () => {
      // Coordenadas exactas dentro del bounding box de Bilbao
      expect(getCityLabel(43.30, -2.85)).toBe('Bilbao')
    })

    it('devuelve España para coordenadas genéricas de España', () => {
      expect(getCityLabel(42.0, -3.0)).toBe('España')
    })
  })

  describe('ciudades europeas', () => {
    it('devuelve Paris para coordenadas de París', () => {
      expect(getCityLabel(48.86, 2.35)).toBe('Paris')
    })

    it('devuelve London para coordenadas de Londres', () => {
      expect(getCityLabel(51.51, -0.13)).toBe('London')
    })

    it('devuelve Berlin para coordenadas de Berlín', () => {
      expect(getCityLabel(52.52, 13.41)).toBe('Berlin')
    })
  })

  describe('ubicaciones desconocidas', () => {
    it('devuelve "Near you" para coordenadas de Nueva York', () => {
      expect(getCityLabel(40.71, -74.01)).toBe('Near you')
    })

    it('devuelve "Near you" para coordenadas de Tokio', () => {
      expect(getCityLabel(35.68, 139.69)).toBe('Near you')
    })

    it('devuelve "Near you" para coordenadas nulas', () => {
      expect(getCityLabel(0, 0)).toBe('Near you')
    })
  })
})
