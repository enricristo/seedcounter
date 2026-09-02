import { describe, it, expect } from 'vitest';
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

    it('clamps values above 1', () => {
      expect(arcsinTransform(1.1)).toBe(Math.PI / 2);
    });
  });

  describe('transformPercentages', () => {
    it('transforms an array of percentages (0-100)', () => {
      const input = [0, 50, 100];
      const output = transformPercentages(input);
      expect(output[0]).toBe(0);
      expect(output[1]).toBeCloseTo(Math.PI / 4, 5);
      expect(output[2]).toBe(Math.PI / 2);
    });

    it('handles an empty array', () => {
      expect(transformPercentages([])).toEqual([]);
    });

    it('handles negative percentages by clamping to 0', () => {
      const input = [-10, -50];
      const output = transformPercentages(input);
      expect(output[0]).toBe(0);
      expect(output[1]).toBe(0);
    });

    it('handles percentages above 100 by clamping to 1', () => {
      const input = [110, 150];
      const output = transformPercentages(input);
      expect(output[0]).toBe(Math.PI / 2);
      expect(output[1]).toBe(Math.PI / 2);
    });
  });
});
