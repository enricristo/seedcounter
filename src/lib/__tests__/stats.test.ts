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
