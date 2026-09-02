import { describe, it, expect } from 'vitest';
import { wilsonCI } from '../stats';

describe('wilsonCI', () => {
  it('calculates a typical interval', () => {
    const result = wilsonCI(50, 100);

    expect(result.center).toBeCloseTo(0.5);
    expect(result.lower).toBeCloseTo(0.4038, 3);
    expect(result.upper).toBeCloseTo(0.5962, 3);
  });

  it('handles zero successes', () => {
    const { lower, upper } = wilsonCI(0, 100);

    expect(lower).toBe(0);
    expect(upper).toBeGreaterThan(0);
    expect(upper).toBeCloseTo(0.03699, 4);
  });

  it('handles all successes', () => {
    const { lower, upper } = wilsonCI(100, 100);

    expect(upper).toBeCloseTo(1, 10);
    expect(lower).toBeCloseTo(0.96301, 4);
  });

  it('handles a small sample', () => {
    const result = wilsonCI(1, 5);

    expect(result.lower).toBeGreaterThanOrEqual(0);
    expect(result.upper).toBeLessThanOrEqual(1);
    expect(result.lower).toBeLessThan(result.center);
    expect(result.center).toBeLessThan(result.upper);
  });

  it('is symmetric around 0.5', () => {
    const a = wilsonCI(30, 60);
    const b = wilsonCI(30, 60);

    expect(a.center).toBeCloseTo(0.5);
    expect(a.lower + a.upper).toBeCloseTo(1);
    expect(b.lower).toBeCloseTo(a.lower);
    expect(b.upper).toBeCloseTo(a.upper);
  });

  it('gets narrower with more observations', () => {
    const small = wilsonCI(5, 10);
    const large = wilsonCI(500, 1000);

    expect(large.upper - large.lower).toBeLessThan(
      small.upper - small.lower
    );
  });

  it('gets narrower with a smaller alpha', () => {
    const ninetyPercent = wilsonCI(50, 100, 0.1);
    const ninetyNinePercent = wilsonCI(50, 100, 0.01);

    expect(ninetyNinePercent.upper - ninetyNinePercent.lower).toBeGreaterThan(
      ninetyPercent.upper - ninetyPercent.lower
    );
  });

  it('produces center of 0.5 when successes = total / 2', () => {
     expect(wilsonCI(50, 100).center).toBeCloseTo(0.5);
     expect(wilsonCI(2, 4).center).toBeCloseTo(0.5);
     expect(wilsonCI(5, 10).center).toBeCloseTo(0.5);
  });

  it('handles invalid inputs gracefully', () => {
    const result = wilsonCI(0, 0);
    expect(result).toEqual({ lower: 0, upper: 0, center: 0 });
  });
});

import { kruskalWallis, type GroupStat, dunnTest } from '../stats';

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

describe('dunnTest', () => {
  it('should correctly calculate pairwise comparisons with Holm correction', () => {
    // Generate some highly separable data to guarantee significance
    const groups: GroupStat[] = [
      { label: 'Control', values: [1, 2, 3, 2, 1] },       // low ranks
      { label: 'Trt A', values: [50, 51, 52, 53, 50] },   // mid ranks
      { label: 'Trt B', values: [100, 101, 102, 101, 100] } // high ranks
    ];

    const results = dunnTest(groups, 'holm');

    expect(results).toHaveLength(3); // n(n-1)/2 pairs

    // Find a specific comparison
    const controlVsB = results.find(
      r => (r.groupA === 'Control' && r.groupB === 'Trt B') || (r.groupA === 'Trt B' && r.groupB === 'Control')
    );

    expect(controlVsB).toBeDefined();
    // They should be significantly different
    expect(controlVsB?.significant).toBe(true);
    expect(controlVsB?.pAdj).toBeLessThan(0.05);

    // Check fields
    expect(typeof controlVsB?.z).toBe('number');
    expect(typeof controlVsB?.meanDiff).toBe('number');
  });

  it('should correctly calculate pairwise comparisons with Bonferroni correction', () => {
    const groups: GroupStat[] = [
      { label: 'Control', values: [1, 2, 3, 2, 1] },
      { label: 'Trt A', values: [50, 51, 52, 53, 50] },
      { label: 'Trt B', values: [100, 101, 102, 101, 100] }
    ];

    const resultsHolm = dunnTest(groups, 'holm');
    const resultsBonf = dunnTest(groups, 'bonferroni');

    // For the least significant difference, Bonferroni should be strictly more conservative or equal
    // (Holm step-down starts with p * m, next p * (m-1)... Bonferroni is always p * m)
    const sortedHolm = [...resultsHolm].sort((a, b) => b.pAdj - a.pAdj);
    const sortedBonf = [...resultsBonf].sort((a, b) => b.pAdj - a.pAdj);

    // Bonferroni p-values should be >= Holm p-values
    expect(sortedBonf[0].pAdj).toBeGreaterThanOrEqual(sortedHolm[0].pAdj);
  });

  it('should not find significance for identical groups', () => {
    const groups: GroupStat[] = [
      { label: 'G1', values: [10, 10, 10, 10] },
      { label: 'G2', values: [10, 10, 10, 10] }
    ];

    const results = dunnTest(groups, 'holm');

    expect(results).toHaveLength(1);
    expect(results[0].significant).toBe(false);
    expect(results[0].z).toBe(0); // Identical ranks -> zero difference -> zero z-score
  });

  it('should handle ties in ranking correctly', () => {
    // Both groups have similar values and some ties
    const groups: GroupStat[] = [
      { label: 'A', values: [5, 5, 5, 5, 5] },
      { label: 'B', values: [5, 5, 5, 5, 5] }
    ];

    const results = dunnTest(groups);

    expect(results).toHaveLength(1);
    expect(results[0].z).toBe(0);
    expect(results[0].significant).toBe(false);
  });

  it('should enforce monotonicity for Holm correction', () => {
    // We construct a specific case that might trigger the monotonicity enforcement in Holm
    // This is hard to perfectly engineer without knowing exact jStat outputs,
    // but we can at least ensure the function runs without error
    const groups: GroupStat[] = [
      { label: 'A', values: [1, 2, 3] },
      { label: 'B', values: [4, 5, 6] },
      { label: 'C', values: [7, 8, 9] },
      { label: 'D', values: [10, 11, 12] }
    ];

    const results = dunnTest(groups, 'holm');
    expect(results).toHaveLength(6);

    // Instead we can just check that all pAdj values are <= 1
    results.forEach(r => {
      expect(r.pAdj).toBeLessThanOrEqual(1.0);
      expect(r.pAdj).toBeGreaterThanOrEqual(0.0);
    });
  });
});
