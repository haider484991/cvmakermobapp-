/**
 * Performance Utilities
 * Helpers for optimizing React Native app performance
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';

/**
 * Debounce a function call
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
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

/**
 * Throttle a function call
 * @param fn Function to throttle
 * @param limit Time limit in milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
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

/**
 * Hook for debounced value
 * @param value Value to debounce
 * @param delay Delay in milliseconds
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const previousValue = useRef<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      previousValue.current = value;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return previousValue.current;
}

/**
 * Hook for debounced callback
 * @param callback Callback to debounce
 * @param delay Delay in milliseconds
 * @param deps Dependencies array
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [delay, ...deps]
  );
}

/**
 * Hook for throttled callback
 * @param callback Callback to throttle
 * @param limit Time limit in milliseconds
 * @param deps Dependencies array
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number,
  deps: React.DependencyList
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCallRef.current >= limit) {
        callback(...args);
        lastCallRef.current = now;
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastCallRef.current = Date.now();
          timeoutRef.current = null;
        }, limit - (now - lastCallRef.current));
      }
    },
    [limit, ...deps]
  );
}

/**
 * Hook for previous value
 * Useful for comparing current and previous values
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Hook for stable callback reference
 * Maintains the same function reference across renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}

/**
 * Batch multiple state updates
 * @param updates Array of update functions
 */
export function batchUpdates(updates: Array<() => void>): void {
  // React Native automatically batches updates in most cases
  // This is a placeholder for any future optimizations
  updates.forEach((update) => update());
}

/**
 * Memoize a function with a simple cache
 * @param fn Function to memoize
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T
): T {
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

/**
 * Create a lazy initializer
 * @param initializer Function that returns the initial value
 */
export function lazy<T>(initializer: () => T): () => T {
  let value: T | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      value = initializer();
      initialized = true;
    }
    return value as T;
  };
}

/**
 * Check if two arrays are shallowly equal
 */
export function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

/**
 * Check if two objects are shallowly equal
 */
export function shallowObjectEqual<T extends Record<string, unknown>>(
  a: T,
  b: T
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => a[key] === b[key]);
}

/**
 * Create a selector that memoizes based on input
 */
export function createSelector<TState, TResult>(
  selector: (state: TState) => TResult
): (state: TState) => TResult {
  let lastState: TState | undefined;
  let lastResult: TResult | undefined;

  return (state: TState): TResult => {
    if (state === lastState && lastResult !== undefined) {
      return lastResult;
    }

    lastState = state;
    lastResult = selector(state);
    return lastResult;
  };
}

/**
 * RAF-based timing for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let latestArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    latestArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        fn(...(latestArgs as Parameters<T>));
        rafId = null;
      });
    }
  };
}

/**
 * Chunk an array into smaller arrays
 * Useful for processing large lists in batches
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process items in batches with a delay
 * @param items Items to process
 * @param batchSize Number of items per batch
 * @param processor Function to process each item
 * @param delay Delay between batches in ms
 */
export async function processBatched<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => R | Promise<R>,
  delay = 0
): Promise<R[]> {
  const results: R[] = [];
  const batches = chunk(items, batchSize);

  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}
