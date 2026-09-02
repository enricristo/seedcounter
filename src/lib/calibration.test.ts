import { describe, it, expect } from 'vitest';
import { umPerPixelToDpi, UNIT_TO_MICRONS } from './calibration';

describe('umPerPixelToDpi', () => {
  it('should correctly convert um/pixel to DPI for common values', () => {
    // 3600 DPI = ~7.0555 um/pixel
    const umPerPixel3600 = UNIT_TO_MICRONS.in / 3600;
    expect(umPerPixelToDpi(umPerPixel3600)).toBeCloseTo(3600, 5);

    // 1200 DPI = ~21.166 um/pixel
    const umPerPixel1200 = UNIT_TO_MICRONS.in / 1200;
    expect(umPerPixelToDpi(umPerPixel1200)).toBeCloseTo(1200, 5);

    // 600 DPI = ~42.333 um/pixel
    const umPerPixel600 = UNIT_TO_MICRONS.in / 600;
    expect(umPerPixelToDpi(umPerPixel600)).toBeCloseTo(600, 5);
  });

  it('should return 0 for invalid inputs', () => {
    expect(umPerPixelToDpi(0)).toBe(0);
    expect(umPerPixelToDpi(-10)).toBe(0);
    expect(umPerPixelToDpi(NaN)).toBe(0);
  });
});
