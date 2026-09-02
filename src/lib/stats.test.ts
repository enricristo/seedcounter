import { describe, it, expect } from 'vitest';
import { calculateIVG, calculateMGT, calculateCVG, calculateT50 } from './stats';
import type { GerminationReading } from '../types';

describe('calculateIVG', () => {
  it('should return 0 when readings array is empty', () => {
    expect(calculateIVG([])).toBe(0);
  });

  it('should calculate IVG correctly for single day reading', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: 10 } // 10 / 2 = 5
    ];
    expect(calculateIVG(readings)).toBe(5);
  });

  it('should calculate IVG correctly for multiple readings', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: 10 }, // 10 / 2 = 5
      { day: 4, germinated: 4 },  // 4 / 4 = 1
      { day: 5, germinated: 0 }   // 0 / 5 = 0
    ];
    expect(calculateIVG(readings)).toBe(6);
  });

  it('should ignore negative or zero days', () => {
    const readings: GerminationReading[] = [
      { day: -1, germinated: 10 },
      { day: 0, germinated: 5 },
      { day: 2, germinated: 4 } // 4 / 2 = 2
    ];
    expect(calculateIVG(readings)).toBe(2);
  });

  it('should ignore negative or zero germinated count', () => {
    const readings: GerminationReading[] = [
      { day: 2, germinated: -5 },
      { day: 3, germinated: 0 },
      { day: 4, germinated: 8 } // 8 / 4 = 2
    ];
    expect(calculateIVG(readings)).toBe(2);
  });

  it('should handle large decimals properly', () => {
    const readings: GerminationReading[] = [
      { day: 3, germinated: 10 } // 10 / 3 = 3.333...
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
      { day: 2, germinated: 4 }, // 4 * 2 = 8
      { day: 3, germinated: 6 }, // 6 * 3 = 18
      { day: 5, germinated: 2 }, // 2 * 5 = 10
    ];
    // Total germinated: 4 + 6 + 2 = 12
    // Weighted days: 8 + 18 + 10 = 36
    // MGT: 36 / 12 = 3
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
    // MGT is 3, CVG is (1/3) * 100 = 33.3333...
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
    // Total 4, target 5 (10 seeds total)
    expect(calculateT50(readings, 10)).toBeNull();
  });

  it('should calculate T50 correctly with linear interpolation', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 2 }, // cum: 2
      { day: 3, germinated: 4 }, // cum: 6
    ];
    // Total seeds: 10, target: 5
    // Between day 1 (cum 2) and day 3 (cum 6)
    // slope = (3 - 1) / (6 - 2) = 2 / 4 = 0.5
    // T50 = 1 + 0.5 * (5 - 2) = 1 + 1.5 = 2.5
    expect(calculateT50(readings, 10)).toBe(2.5);
  });

  it('should calculate T50 correctly when target is exact', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 2 }, // cum: 2
      { day: 3, germinated: 3 }, // cum: 5
      { day: 4, germinated: 1 }, // cum: 6
    ];
    // Total seeds: 10, target: 5
    // Between day 1 (cum 2) and day 3 (cum 5)
    // slope = (3 - 1) / (5 - 2) = 2 / 3
    // T50 = 1 + (2/3) * (5 - 2) = 1 + 2 = 3
    expect(calculateT50(readings, 10)).toBe(3);
import { describeGroup } from './stats';

describe('describeGroup', () => {
  it('returns null for an empty array', () => {
    expect(describeGroup([])).toBeNull();
  });

  it('calculates descriptive statistics correctly for typical values', () => {
    const result = describeGroup([1, 2, 3, 4, 5]);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.n).toBe(5);
    expect(result.mean).toBe(3);
    // sd = sqrt(sum((x - mean)^2) / (n - 1))
    // x = [1, 2, 3, 4, 5], mean = 3
    // sq diff = [4, 1, 0, 1, 4], sum = 10
    // sd = sqrt(10 / 4) = sqrt(2.5) ~ 1.58113883
    expect(result.sd).toBeCloseTo(1.41421356, 5);
    expect(result.min).toBe(1);
    expect(result.max).toBe(5);

    // Check quantiles.
    expect(result.q1).toBeDefined();
    expect(result.median).toBe(3);
    expect(result.q3).toBeDefined();

    // cv = (sd / mean) * 100
    // (1.58113883 / 3) * 100 ~ 52.704627
    expect(result.cv).toBeCloseTo(47.140452, 5);
  });

  it('handles a single-element array correctly (sd and cv are 0)', () => {
    const result = describeGroup([42]);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.n).toBe(1);
    expect(result.mean).toBe(42);
    expect(result.sd).toBe(0);
    expect(result.min).toBe(42);
    expect(result.max).toBe(42);
    expect(result.q1).toBe(42);
    expect(result.median).toBe(42);
    expect(result.q3).toBe(42);
    expect(result.cv).toBe(0);
  });

  it('handles array with duplicate values correctly', () => {
    const result = describeGroup([2, 2, 2]);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.n).toBe(3);
    expect(result.mean).toBe(2);
    expect(result.sd).toBe(0);
    expect(result.min).toBe(2);
    expect(result.max).toBe(2);
    expect(result.cv).toBe(0);
  });
});
