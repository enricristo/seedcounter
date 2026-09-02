import { describe, it, expect } from 'vitest';
import { kruskalWallis, type GroupStat } from '../stats';

describe('kruskalWallis', () => {
  it('should correctly calculate H and p-value for a known dataset', () => {
    // Example dataset:
    // Group 1: 5.2, 5.7, 6.2, 5.5
    // Group 2: 7.1, 7.3, 7.5, 7.2
    // Group 3: 4.8, 5.1, 5.0, 4.9
    const groups: GroupStat[] = [
      { label: 'G1', values: [5.2, 5.7, 6.2, 5.5] },
      { label: 'G2', values: [7.1, 7.3, 7.5, 7.2] },
      { label: 'G3', values: [4.8, 5.1, 5.0, 4.9] }
    ];

    const result = kruskalWallis(groups);

    // Assertions
    // For this dataset, the groups are clearly distinct.
    // The test should yield a significant result.
    expect(result).toHaveProperty('H');
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('significant');
    expect(typeof result.H).toBe('number');
    expect(typeof result.pValue).toBe('number');
    expect(typeof result.significant).toBe('boolean');

    // With such clear separation, the p-value should be very low and significant.
    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    // H should be relatively large
    expect(result.H).toBeGreaterThan(5);
  });

  it('should not be significant when groups are identical', () => {
    const groups: GroupStat[] = [
      { label: 'G1', values: [5, 6, 7] },
      { label: 'G2', values: [5, 6, 7] },
      { label: 'G3', values: [5, 6, 7] }
    ];

    const result = kruskalWallis(groups);

    // When all groups have the same values, there should be no significant difference
    expect(result.significant).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05);
    // When distributions are exactly the same, H should be close to 0
    expect(result.H).toBeCloseTo(0, 1);
  });

  it('should handle ties correctly', () => {
    // Dataset with many ties
    const groups: GroupStat[] = [
      { label: 'G1', values: [1, 1, 1, 2] },
      { label: 'G2', values: [2, 2, 3, 3] },
      { label: 'G3', values: [3, 4, 4, 4] }
    ];

    const result = kruskalWallis(groups);

    expect(result).toHaveProperty('H');
    expect(result.H).toBeGreaterThan(0);
    // Group 1 is lower, Group 3 is higher, so it should find a difference
    expect(result.significant).toBe(true);
  });

  it('should return correct results for minimal input', () => {
    // Minimum valid input for KW is usually 2 groups with at least 1 item each
    const groups: GroupStat[] = [
      { label: 'G1', values: [1] },
      { label: 'G2', values: [2] }
    ];

    const result = kruskalWallis(groups);

    expect(result).toHaveProperty('H');
    // With n=1 per group, it shouldn't be statistically significant at alpha=0.05
    expect(result.significant).toBe(false);
  });
});

import { arcsinTransform, transformPercentages } from '../stats';

describe('Data Transformation', () => {
  describe('arcsinTransform', () => {
    it('transforms 0 correctly', () => {
      expect(arcsinTransform(0)).toBe(0);
    });

    it('transforms 1 correctly', () => {
      expect(arcsinTransform(1)).toBe(Math.PI / 2);
    });

    it('transforms 0.5 correctly', () => {
      expect(arcsinTransform(0.5)).toBeCloseTo(Math.PI / 4, 5);
    });

    it('clamps values below 0', () => {
      expect(arcsinTransform(-0.1)).toBe(0);
    });
  });
});

import { calculateMGT, calculateIVG, calculateCVG, calculateT50 } from '../stats';
import type { GerminationReading } from '../../types';

describe('calculateMGT', () => {
  it('should calculate Mean Germination Time correctly', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 2 },
      { day: 2, germinated: 5 },
      { day: 3, germinated: 3 },
    ];
    // MGT = (1*2 + 2*5 + 3*3) / (2 + 5 + 3) = 21 / 10 = 2.1
    expect(calculateMGT(readings)).toBe(2.1);
  });

  it('should handle single day germination', () => {
    const readings: GerminationReading[] = [
      { day: 4, germinated: 10 },
    ];
    expect(calculateMGT(readings)).toBe(4);
  });

  it('should return 0 for an empty array', () => {
    expect(calculateMGT([])).toBe(0);
  });

  it('should return 0 when total germinated is 0', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 0 },
      { day: 2, germinated: 0 },
    ];
    expect(calculateMGT(readings)).toBe(0);
  });

  it('should correctly handle readings with some 0 germination days', () => {
    const readings: GerminationReading[] = [
      { day: 1, germinated: 0 },
      { day: 2, germinated: 5 },
      { day: 3, germinated: 0 },
      { day: 4, germinated: 5 },
    ];
    // MGT = (2*5 + 4*5) / 10 = 30 / 10 = 3
    expect(calculateMGT(readings)).toBe(3);
  });

  it('should compute correctly for fractional days if provided', () => {
    const readings: GerminationReading[] = [
      { day: 1.5, germinated: 2 },
      { day: 2.5, germinated: 4 },
    ];
    // MGT = (1.5*2 + 2.5*4) / 6 = (3 + 10) / 6 = 13 / 6 ≈ 2.1666...
    expect(calculateMGT(readings)).toBeCloseTo(13 / 6);
  });
});

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
