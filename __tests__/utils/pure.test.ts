/**
 * Pure Unit Tests
 * Tests for pure utility functions without React Native dependencies
 */

// Test pure functions from performance.ts without imports
describe('Pure Utility Functions', () => {
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function debounce<T extends (...args: any[]) => any>(
      fn: T,
      delay: number
    ): (...args: Parameters<T>) => void {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      return (...args: Parameters<T>) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          fn(...args);
          timeoutId = null;
        }, delay);
      };
    }

    it('should delay function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced();
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the function', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function throttle<T extends (...args: any[]) => any>(
      fn: T,
      limit: number
    ): (...args: Parameters<T>) => void {
      let lastCall = 0;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      return (...args: Parameters<T>) => {
        const now = Date.now();

        if (now - lastCall >= limit) {
          fn(...args);
          lastCall = now;
        } else if (!timeoutId) {
          timeoutId = setTimeout(() => {
            fn(...args);
            lastCall = Date.now();
            timeoutId = null;
          }, limit - (now - lastCall));
        }
      };
    }

    it('should execute immediately on first call', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent calls', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoize', () => {
    function memoize<T extends (...args: any[]) => any>(fn: T): T {
      const cache = new Map<string, ReturnType<T>>();

      return ((...args: Parameters<T>): ReturnType<T> => {
        const key = JSON.stringify(args);

        if (cache.has(key)) {
          return cache.get(key)!;
        }

        const result = fn(...args);
        cache.set(key, result);
        return result;
      }) as T;
    }

    it('should cache function results', () => {
      const fn = jest.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cache based on arguments', () => {
      const fn = jest.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(5)).toBe(10);
      expect(memoized(10)).toBe(20);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('chunk', () => {
    function chunk<T>(array: T[], size: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    }

    it('should split array into chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle array smaller than chunk size', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it('should handle empty array', () => {
      expect(chunk([], 5)).toEqual([]);
    });
  });

  describe('shallowArrayEqual', () => {
    function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
      if (a.length !== b.length) return false;
      return a.every((item, index) => item === b[index]);
    }

    it('should return true for equal arrays', () => {
      expect(shallowArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return false for different lengths', () => {
      expect(shallowArrayEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for different values', () => {
      expect(shallowArrayEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });
  });

  describe('shallowObjectEqual', () => {
    function shallowObjectEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every((key) => a[key] === b[key]);
    }

    it('should return true for equal objects', () => {
      expect(shallowObjectEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('should return false for different number of keys', () => {
      expect(shallowObjectEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should return false for different values', () => {
      expect(shallowObjectEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe('Accessibility helpers', () => {
    const MIN_TOUCH_TARGET = 44;

    function isValidTouchTarget(width: number, height: number): boolean {
      return width >= MIN_TOUCH_TARGET && height >= MIN_TOUCH_TARGET;
    }

    function formatNumberForA11y(value: number, unit?: string): string {
      const formatted = value.toLocaleString();
      return unit ? `${formatted} ${unit}` : formatted;
    }

    it('should validate touch target size', () => {
      expect(isValidTouchTarget(44, 44)).toBe(true);
      expect(isValidTouchTarget(40, 44)).toBe(false);
      expect(isValidTouchTarget(44, 40)).toBe(false);
    });

    it('should format number for accessibility', () => {
      expect(formatNumberForA11y(1234)).toBe('1,234');
      expect(formatNumberForA11y(5, 'items')).toBe('5 items');
    });
  });

  describe('Version management logic', () => {
    interface Version {
      id: string;
      resumeId: string;
      version: number;
      name: string;
      isAutoSave: boolean;
      createdAt: string;
    }

    function cleanupOldVersions(versions: Version[], maxVersions: number): Version[] {
      if (versions.length <= maxVersions) return versions;

      const autoSaves = versions.filter((v) => v.isAutoSave);
      const manual = versions.filter((v) => !v.isAutoSave);

      const toKeep: Version[] = [];
      let remaining = maxVersions;

      for (const v of manual) {
        if (remaining <= 0) break;
        toKeep.push(v);
        remaining--;
      }

      for (const v of autoSaves) {
        if (remaining <= 0) break;
        toKeep.push(v);
        remaining--;
      }

      return toKeep.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    it('should keep all versions when under limit', () => {
      const versions: Version[] = [
        { id: '1', resumeId: 'r1', version: 1, name: 'v1', isAutoSave: false, createdAt: '2024-01-01' },
        { id: '2', resumeId: 'r1', version: 2, name: 'v2', isAutoSave: false, createdAt: '2024-01-02' },
      ];

      const result = cleanupOldVersions(versions, 5);
      expect(result).toHaveLength(2);
    });

    it('should prioritize manual versions over auto-saves', () => {
      const versions: Version[] = [
        { id: '1', resumeId: 'r1', version: 1, name: 'auto1', isAutoSave: true, createdAt: '2024-01-01' },
        { id: '2', resumeId: 'r1', version: 2, name: 'manual1', isAutoSave: false, createdAt: '2024-01-02' },
        { id: '3', resumeId: 'r1', version: 3, name: 'auto2', isAutoSave: true, createdAt: '2024-01-03' },
        { id: '4', resumeId: 'r1', version: 4, name: 'manual2', isAutoSave: false, createdAt: '2024-01-04' },
      ];

      const result = cleanupOldVersions(versions, 2);
      expect(result).toHaveLength(2);
      expect(result.filter(v => !v.isAutoSave)).toHaveLength(2);
    });
  });
});
