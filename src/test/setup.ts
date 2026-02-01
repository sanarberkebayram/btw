/**
 * BTW - Vitest Global Setup
 *
 * This file is loaded before each test file. Use it for:
 * - Global test configuration
 * - Custom matchers
 * - Global mocks
 * - Test utilities
 */

import { expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Custom matchers for BTW testing
 */
expect.extend({
  /**
   * Check if a value is a valid BTWError with specific code
   */
  toBeBTWErrorWithCode(received, expectedCode: string) {
    const isBTWError =
      received instanceof Error &&
      received.name === 'BTWError' &&
      'code' in received;

    if (!isBTWError) {
      return {
        pass: false,
        message: () => `Expected ${received} to be a BTWError`,
      };
    }

    const actualCode = (received as { code: string }).code;
    const pass = actualCode === expectedCode;

    return {
      pass,
      message: () =>
        pass
          ? `Expected BTWError not to have code ${expectedCode}`
          : `Expected BTWError to have code ${expectedCode}, but got ${actualCode}`,
    };
  },

  /**
   * Check if a string is a valid ISO 8601 date
   */
  toBeValidISODate(received) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a string`,
      };
    }

    const date = new Date(received);
    const isValid = !isNaN(date.getTime()) && received === date.toISOString();

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid ISO 8601 date`
          : `Expected ${received} to be a valid ISO 8601 date`,
    };
  },
});

/**
 * Global test hooks
 */

// Reset any environment variables that tests might modify
const originalEnv = { ...process.env };

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore original environment
  process.env = { ...originalEnv };

  // Restore all mocked modules
  vi.restoreAllMocks();
});

/**
 * Augment Vitest's expect interface with custom matchers
 */
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toBeBTWErrorWithCode(code: string): void;
    toBeValidISODate(): void;
  }
  interface AsymmetricMatchersContaining {
    toBeBTWErrorWithCode(code: string): unknown;
    toBeValidISODate(): unknown;
  }
}

/**
 * Test utilities
 */

/**
 * Create a mock error for testing
 */
export function createMockError(message: string = 'Mock error'): Error {
  const error = new Error(message);
  error.name = 'MockError';
  return error;
}

/**
 * Create a mock file system error
 */
export function createMockFsError(
  code: string,
  message: string = 'File system error'
): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

/**
 * Helper to test async error throwing
 */
export async function expectAsyncError<T extends Error>(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: unknown[]) => T
): Promise<T> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (error instanceof ErrorClass) {
      return error;
    }
    throw error;
  }
}

/**
 * Freeze time for deterministic date testing
 */
export function freezeTime(date: Date | string | number = new Date()): () => void {
  const frozenDate = new Date(date);
  const originalDate = global.Date;

  // Create a mock Date class
  const MockDate = class extends originalDate {
    constructor(...args: Parameters<typeof originalDate>) {
      if (args.length === 0) {
        super(frozenDate.getTime());
      } else {
        // @ts-expect-error - spread args to Date constructor
        super(...args);
      }
    }

    static now(): number {
      return frozenDate.getTime();
    }
  } as DateConstructor;

  global.Date = MockDate;

  // Return cleanup function
  return () => {
    global.Date = originalDate;
  };
}
