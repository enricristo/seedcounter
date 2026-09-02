import { describe, it, expect } from 'vitest';
import { calculateIVG, calculateMGT, calculateCVG, calculateT50 } from './stats';
import type { GerminationReading } from '../types';

describe('calculateIVG', () => {
  it('should return 0 when readings array is empty', () => {
    expect(calculateIVG([])).toBe(0);
  });

  it('should calculate IVG correctly for single day reading', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: 10 }
    ];
    expect(calculateIVG(readings)).toBe(5);
  });

  it('should calculate IVG correctly for multiple readings', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: 10 },
      { day: 4, germinated: 4 },
      { day: 5, germinated: 0 }
    ];
    expect(calculateIVG(readings)).toBe(6);
  });

  it('should ignore negative or zero days', () => {
    const readings: GerminationReading[] = [
      { day: -1, germinated: 10 },
      { day: 0, germinated: 5 },
      { day: 2, germinated: 4 }
    ];
    expect(calculateIVG(readings)).toBe(2);
  });

  it('should ignore negative or zero germinated count', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: -5 },
      { day: 3, germinated: 0 },
      { day: 4, germinated: 8 }
    ];
    expect(calculateIVG(readings)).toBe(2);
  });

  it('should handle large decimals properly', () => {
    const readings: GerminationReading[] = [
      { day: 3, germinated: 10 }
    ];
    expect(calculateIVG(readings)).toBeCloseTo(3.3333, 4);
  });
});

describe('calculateMGT', () => {
  it('should return 0 when readings array is empty', () => {
    expect(calculateMGT([])).toBe(0);
  });

  it('should return 0 when no seeds germinated', () => {
    expect(calculateMGT([{ day: 1, germinated: 0 }, { day: 2, germinated: 0 }])).toBe(0);
  });

  it('should calculate MGT correctly', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: 4 },
      { day: 3, germinated: 6 },
      { day: 5, germinated: 2 },
    ];
    expect(calculateMGT(readings)).toBe(3);
  });
});

describe('calculateCVG', () => {
  it('should return 0 when readings array is empty', () => {
    expect(calculateCVG([])).toBe(0);
  });

  it('should return 0 when MGT is 0', () => {
    expect(calculateCVG([{ day: 1, germinated: 0 }])).toBe(0);
  });

  it('should calculate CVG correctly', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: 4 },
      { day: 3, germinated: 6 },
      { day: 5, germinated: 2 },
    ];
    expect(calculateCVG(readings)).toBeCloseTo(33.3333, 4);
  });
});

describe('calculateT50', () => {
  it('should return null when total seeds is 0', () => {
    expect(calculateT50([{ day: 1, germinated: 5 }], 0)).toBeNull();
  });

  it('should return null when target is not reached', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 2 },
      { day: 2, germinated: 2 },
    ];
    expect(calculateT50(readings, 10)).toBeNull();
  });

  it('should calculate T50 correctly with linear interpolation', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 2 },
      { day: 3, germinated: 4 },
    ];
    expect(calculateT50(readings, 10)).toBe(2.5);
  });

  it('should calculate T50 correctly when target is exact', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 2 },
      { day: 3, germinated: 3 },
      { day: 4, germinated: 1 },
    ];
    expect(calculateT50(readings, 10)).toBe(3);
  });
});
