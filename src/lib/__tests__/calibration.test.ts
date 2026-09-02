import { describe, it, expect } from 'vitest';
import { distanceInPixels } from '../calibration';

describe('distanceInPixels', () => {
  it('should calculate the Euclidean distance correctly', () => {
    // 3-4-5 right triangle
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(distanceInPixels(a, b)).toBe(5);
  });

  it('should handle negative coordinates', () => {
    const a = { x: -1, y: -2 };
    const b = { x: -4, y: -6 }; // diff x = -3, diff y = -4, hypot = 5
    expect(distanceInPixels(a, b)).toBe(5);
  });

  it('should return 0 when points are the same', () => {
    const a = { x: 10, y: 20 };
    const b = { x: 10, y: 20 };
    expect(distanceInPixels(a, b)).toBe(0);
  });

  it('should handle fractional coordinates', () => {
    const a = { x: 1.5, y: 2.5 };
    const b = { x: 4.5, y: 6.5 }; // diff x = 3, diff y = 4, hypot = 5
    expect(distanceInPixels(a, b)).toBe(5);
  });

  it('should be symmetric', () => {
    const a = { x: 10, y: 20 };
    const b = { x: -5, y: 30 };
    expect(distanceInPixels(a, b)).toBe(distanceInPixels(b, a));
  });
});
