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
