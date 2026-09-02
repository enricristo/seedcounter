import { describe, it, expect } from 'vitest';
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
