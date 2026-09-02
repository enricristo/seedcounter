import { describe, it, expect } from 'vitest';
import { dpiToUmPerPixel, umPerPixelToDpi, referenceToUmPerPixel } from './calibration';

describe('Calibration Conversions', () => {
  describe('dpiToUmPerPixel', () => {
    it('should calculate um per pixel correctly for valid DPI', () => {
      // 25400 / 300 = 84.666...
      expect(dpiToUmPerPixel(300)).toBeCloseTo(84.6667, 4);
      // 25400 / 25400 = 1
      expect(dpiToUmPerPixel(25400)).toBe(1);
      // 25400 / 1200 = 21.166...
      expect(dpiToUmPerPixel(1200)).toBeCloseTo(21.1667, 4);
    });

    it('should return 0 for 0 DPI', () => {
      expect(dpiToUmPerPixel(0)).toBe(0);
    });

    it('should return 0 for negative DPI', () => {
      expect(dpiToUmPerPixel(-100)).toBe(0);
    });

    it('should return 0 for missing/undefined/NaN DPI', () => {
      expect(dpiToUmPerPixel(undefined as any)).toBe(0);
      expect(dpiToUmPerPixel(null as any)).toBe(0);
      expect(dpiToUmPerPixel(NaN)).toBe(0);
    });
  });

  describe('umPerPixelToDpi', () => {
    it('should calculate DPI correctly for valid um per pixel', () => {
      // 25400 / 84.6666... = 300
      expect(umPerPixelToDpi(25400 / 300)).toBeCloseTo(300, 4);
      // 25400 / 1 = 25400
      expect(umPerPixelToDpi(1)).toBe(25400);
      // 25400 / 21.1666... = 1200
      expect(umPerPixelToDpi(25400 / 1200)).toBeCloseTo(1200, 4);
    });

    it('should return 0 for 0 um per pixel', () => {
      expect(umPerPixelToDpi(0)).toBe(0);
    });

    it('should return 0 for negative um per pixel', () => {
      expect(umPerPixelToDpi(-10)).toBe(0);
    });

    it('should return 0 for missing/undefined/NaN um per pixel', () => {
      expect(umPerPixelToDpi(undefined as any)).toBe(0);
      expect(umPerPixelToDpi(null as any)).toBe(0);
      expect(umPerPixelToDpi(NaN)).toBe(0);
    });
  });

  describe('referenceToUmPerPixel', () => {
    it('should return correct um/px for mm', () => {
      // 10mm object, 100 pixels length in image -> 10 * 1000 um / 100 px = 100 um/px
      expect(referenceToUmPerPixel(100, 10, 'mm')).toBe(100);
    });

    it('should return correct um/px for um', () => {
      // 500um object, 50 pixels length -> 500 * 1 um / 50 px = 10 um/px
      expect(referenceToUmPerPixel(50, 500, 'um')).toBe(10);
    });

    it('should return correct um/px for cm', () => {
      // 2cm object, 200 pixels length -> 2 * 10000 um / 200 px = 100 um/px
      expect(referenceToUmPerPixel(200, 2, 'cm')).toBe(100);
    });

    it('should return correct um/px for inches', () => {
      // 1 inch object, 254 pixels length -> 1 * 25400 um / 254 px = 100 um/px
      expect(referenceToUmPerPixel(254, 1, 'in')).toBe(100);
    });

    it('should return 0 when pixels is 0 or negative', () => {
      expect(referenceToUmPerPixel(0, 10, 'mm')).toBe(0);
      expect(referenceToUmPerPixel(-10, 10, 'mm')).toBe(0);
    });

    it('should return 0 when length is 0 or negative', () => {
      expect(referenceToUmPerPixel(100, 0, 'mm')).toBe(0);
      expect(referenceToUmPerPixel(100, -5, 'mm')).toBe(0);
    });

    it('should handle decimal values properly', () => {
      // 0.5 mm = 500 um, measured as 75 pixels -> 500/75 = 6.666...
      expect(referenceToUmPerPixel(75, 0.5, 'mm')).toBeCloseTo(6.666667, 4);
    });
  });
});
