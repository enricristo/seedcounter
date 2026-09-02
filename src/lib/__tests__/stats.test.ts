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
