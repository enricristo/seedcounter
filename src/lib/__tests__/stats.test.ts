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
import { calculateMGT } from '../stats';
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
