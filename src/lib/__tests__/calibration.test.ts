import { describe, it, expect } from 'vitest';
import {
  dpiToUmPerPixel,
  umPerPixelToDpi,
  referenceToUmPerPixel,
  distanceInPixels,
} from '../calibration';

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
    it('should calculate um per pixel correctly for mm reference', () => {
      // 10mm = 10,000um. 10000 / 100 pixels = 100 um/px
      expect(referenceToUmPerPixel(100, 10, 'mm')).toBe(100);
    });

    it('should calculate um per pixel correctly for cm reference', () => {
      // 1cm = 10,000um. 10000 / 200 pixels = 50 um/px
      expect(referenceToUmPerPixel(200, 1, 'cm')).toBe(50);
    });

    it('should calculate um per pixel correctly for um reference', () => {
      // 500um. 500 / 50 pixels = 10 um/px
      expect(referenceToUmPerPixel(50, 500, 'um')).toBe(10);
    });

    it('should calculate um per pixel correctly for in reference', () => {
      // 1in = 25,400um. 25400 / 254 pixels = 100 um/px
      expect(referenceToUmPerPixel(254, 1, 'in')).toBe(100);
    });

    it('should return 0 if pixels is <= 0', () => {
      expect(referenceToUmPerPixel(0, 10, 'mm')).toBe(0);
      expect(referenceToUmPerPixel(-10, 10, 'mm')).toBe(0);
    });

    it('should return 0 if length is <= 0', () => {
      expect(referenceToUmPerPixel(100, 0, 'mm')).toBe(0);
      expect(referenceToUmPerPixel(100, -10, 'mm')).toBe(0);
    });

    it('should handle decimal values properly', () => {
      // 0.5 mm = 500 um, measured as 75 pixels -> 500/75 = 6.666...
      expect(referenceToUmPerPixel(75, 0.5, 'mm')).toBeCloseTo(6.666667, 4);
    });
  });
});


describe('distanceInPixels', () => {
  it('should calculate the Euclidean distance correctly', () => {
    // 3-4-5 right triangle
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(distanceInPixels(a, b)).toBe(5);
  });

  it('should handle negative coordinates', () => {
    const a = { x: -1, y: -2 };
    const b = { x: -4, y: -6 }; // diff x = -3, diff y = -4, hypot = 5
    expect(distanceInPixels(a, b)).toBe(5);
  });

  it('should return 0 when points are the same', () => {
    const a = { x: 10, y: 20 };
    const b = { x: 10, y: 20 };
    expect(distanceInPixels(a, b)).toBe(0);
  });

  it('should handle fractional coordinates', () => {
    const a = { x: 1.5, y: 2.5 };
    const b = { x: 4.5, y: 6.5 }; // diff x = 3, diff y = 4, hypot = 5
    expect(distanceInPixels(a, b)).toBe(5);
  });

  it('should be symmetric', () => {
    const a = { x: 10, y: 20 };
    const b = { x: -5, y: 30 };
    expect(distanceInPixels(a, b)).toBe(distanceInPixels(b, a));
  });
});
