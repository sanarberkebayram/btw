/**
 * BTW - Error Handling Tests
 *
 * Comprehensive test suite for the BTW error handling system.
 * Tests cover:
 * - BTWError class construction and behavior
 * - ErrorCode enum values and organization
 * - ErrorMessages mapping completeness
 * - ErrorHints mapping
 * - Error serialization (toString, toJSON)
 * - Error cause chaining
 * - Error context preservation
 * - Static helper methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BTWError,
  ErrorCode,
  ErrorMessages,
  ErrorHints,
} from '../errors.js';

describe('ErrorCode', () => {
  describe('enum structure', () => {
    it('should define all general error codes (1xx)', () => {
      expect(ErrorCode.UNKNOWN_ERROR).toBe('E100');
      expect(ErrorCode.INVALID_ARGUMENT).toBe('E101');
      expect(ErrorCode.OPERATION_CANCELLED).toBe('E102');
      expect(ErrorCode.INVALID_INPUT).toBe('E103');
    });

    it('should define all file system error codes (2xx)', () => {
      expect(ErrorCode.FILE_NOT_FOUND).toBe('E200');
      expect(ErrorCode.FILE_READ_ERROR).toBe('E201');
      expect(ErrorCode.FILE_WRITE_ERROR).toBe('E202');
      expect(ErrorCode.DIRECTORY_NOT_FOUND).toBe('E203');
      expect(ErrorCode.PERMISSION_DENIED).toBe('E204');
      expect(ErrorCode.PATH_ALREADY_EXISTS).toBe('E205');
    });

    it('should define all manifest error codes (3xx)', () => {
      expect(ErrorCode.MANIFEST_NOT_FOUND).toBe('E300');
      expect(ErrorCode.MANIFEST_PARSE_ERROR).toBe('E301');
      expect(ErrorCode.MANIFEST_VALIDATION_ERROR).toBe('E302');
      expect(ErrorCode.MANIFEST_VERSION_UNSUPPORTED).toBe('E303');
    });

    it('should define all workflow error codes (4xx)', () => {
      expect(ErrorCode.WORKFLOW_NOT_FOUND).toBe('E400');
      expect(ErrorCode.WORKFLOW_ALREADY_EXISTS).toBe('E401');
      expect(ErrorCode.WORKFLOW_INVALID).toBe('E402');
      expect(ErrorCode.WORKFLOW_INSTALLATION_FAILED).toBe('E403');
      expect(ErrorCode.WORKFLOW_REMOVAL_FAILED).toBe('E404');
    });

    it('should define all injection error codes (5xx)', () => {
      expect(ErrorCode.INJECTION_FAILED).toBe('E500');
      expect(ErrorCode.TARGET_NOT_SUPPORTED).toBe('E501');
      expect(ErrorCode.TARGET_CONFIG_NOT_FOUND).toBe('E502');
      expect(ErrorCode.TARGET_CONFIG_INVALID).toBe('E503');
      expect(ErrorCode.BACKUP_FAILED).toBe('E504');
      expect(ErrorCode.RESTORE_FAILED).toBe('E505');
    });

    it('should define all state error codes (6xx)', () => {
      expect(ErrorCode.STATE_NOT_FOUND).toBe('E600');
      expect(ErrorCode.STATE_CORRUPTED).toBe('E601');
      expect(ErrorCode.STATE_WRITE_ERROR).toBe('E602');
      expect(ErrorCode.STATE_VERSION_MISMATCH).toBe('E603');
    });

    it('should define all git error codes (7xx)', () => {
      expect(ErrorCode.GIT_NOT_FOUND).toBe('E700');
      expect(ErrorCode.GIT_CLONE_FAILED).toBe('E701');
      expect(ErrorCode.GIT_PULL_FAILED).toBe('E702');
      expect(ErrorCode.GIT_NOT_A_REPOSITORY).toBe('E703');
    });

    it('should define all network error codes (8xx)', () => {
      expect(ErrorCode.NETWORK_ERROR).toBe('E800');
      expect(ErrorCode.DOWNLOAD_FAILED).toBe('E801');
      expect(ErrorCode.REPOSITORY_NOT_FOUND).toBe('E802');
    });

    it('should have unique error codes', () => {
      const codes = Object.values(ErrorCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should follow Exxx format pattern', () => {
      const codes = Object.values(ErrorCode);
      const pattern = /^E[0-9]{3}$/;
      codes.forEach((code) => {
        expect(code).toMatch(pattern);
      });
    });
  });

  describe('error code organization', () => {
    it('should group general errors in 100 range', () => {
      const generalCodes = [
        ErrorCode.UNKNOWN_ERROR,
        ErrorCode.INVALID_ARGUMENT,
        ErrorCode.OPERATION_CANCELLED,
        ErrorCode.INVALID_INPUT,
      ];
      generalCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(100);
        expect(parseInt(code.slice(1))).toBeLessThan(200);
      });
    });

    it('should group file system errors in 200 range', () => {
      const fsCodes = [
        ErrorCode.FILE_NOT_FOUND,
        ErrorCode.FILE_READ_ERROR,
        ErrorCode.FILE_WRITE_ERROR,
        ErrorCode.DIRECTORY_NOT_FOUND,
        ErrorCode.PERMISSION_DENIED,
        ErrorCode.PATH_ALREADY_EXISTS,
      ];
      fsCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(200);
        expect(parseInt(code.slice(1))).toBeLessThan(300);
      });
    });

    it('should group manifest errors in 300 range', () => {
      const manifestCodes = [
        ErrorCode.MANIFEST_NOT_FOUND,
        ErrorCode.MANIFEST_PARSE_ERROR,
        ErrorCode.MANIFEST_VALIDATION_ERROR,
        ErrorCode.MANIFEST_VERSION_UNSUPPORTED,
      ];
      manifestCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(300);
        expect(parseInt(code.slice(1))).toBeLessThan(400);
      });
    });

    it('should group workflow errors in 400 range', () => {
      const workflowCodes = [
        ErrorCode.WORKFLOW_NOT_FOUND,
        ErrorCode.WORKFLOW_ALREADY_EXISTS,
        ErrorCode.WORKFLOW_INVALID,
        ErrorCode.WORKFLOW_INSTALLATION_FAILED,
        ErrorCode.WORKFLOW_REMOVAL_FAILED,
      ];
      workflowCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(400);
        expect(parseInt(code.slice(1))).toBeLessThan(500);
      });
    });

    it('should group injection errors in 500 range', () => {
      const injectionCodes = [
        ErrorCode.INJECTION_FAILED,
        ErrorCode.TARGET_NOT_SUPPORTED,
        ErrorCode.TARGET_CONFIG_NOT_FOUND,
        ErrorCode.TARGET_CONFIG_INVALID,
        ErrorCode.BACKUP_FAILED,
        ErrorCode.RESTORE_FAILED,
      ];
      injectionCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(500);
        expect(parseInt(code.slice(1))).toBeLessThan(600);
      });
    });

    it('should group state errors in 600 range', () => {
      const stateCodes = [
        ErrorCode.STATE_NOT_FOUND,
        ErrorCode.STATE_CORRUPTED,
        ErrorCode.STATE_WRITE_ERROR,
        ErrorCode.STATE_VERSION_MISMATCH,
      ];
      stateCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(600);
        expect(parseInt(code.slice(1))).toBeLessThan(700);
      });
    });

    it('should group git errors in 700 range', () => {
      const gitCodes = [
        ErrorCode.GIT_NOT_FOUND,
        ErrorCode.GIT_CLONE_FAILED,
        ErrorCode.GIT_PULL_FAILED,
        ErrorCode.GIT_NOT_A_REPOSITORY,
      ];
      gitCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(700);
        expect(parseInt(code.slice(1))).toBeLessThan(800);
      });
    });

    it('should group network errors in 800 range', () => {
      const networkCodes = [
        ErrorCode.NETWORK_ERROR,
        ErrorCode.DOWNLOAD_FAILED,
        ErrorCode.REPOSITORY_NOT_FOUND,
      ];
      networkCodes.forEach((code) => {
        expect(parseInt(code.slice(1))).toBeGreaterThanOrEqual(800);
        expect(parseInt(code.slice(1))).toBeLessThan(900);
      });
    });
  });
});

describe('ErrorMessages', () => {
  it('should have a message for every error code', () => {
    const errorCodes = Object.values(ErrorCode);
    errorCodes.forEach((code) => {
      expect(ErrorMessages[code]).toBeDefined();
      expect(typeof ErrorMessages[code]).toBe('string');
      expect(ErrorMessages[code].length).toBeGreaterThan(0);
    });
  });

  it('should have meaningful messages (not just the code)', () => {
    const errorCodes = Object.values(ErrorCode);
    errorCodes.forEach((code) => {
      expect(ErrorMessages[code]).not.toBe(code);
      expect(ErrorMessages[code].length).toBeGreaterThan(5);
    });
  });

  describe('specific error messages', () => {
    it('should provide clear general error messages', () => {
      expect(ErrorMessages[ErrorCode.UNKNOWN_ERROR]).toBe('An unknown error occurred');
      expect(ErrorMessages[ErrorCode.INVALID_ARGUMENT]).toBe('Invalid argument provided');
      expect(ErrorMessages[ErrorCode.OPERATION_CANCELLED]).toBe('Operation was cancelled');
      expect(ErrorMessages[ErrorCode.INVALID_INPUT]).toBe('Invalid input provided');
    });

    it('should provide clear file system error messages', () => {
      expect(ErrorMessages[ErrorCode.FILE_NOT_FOUND]).toBe('File not found');
      expect(ErrorMessages[ErrorCode.FILE_READ_ERROR]).toBe('Failed to read file');
      expect(ErrorMessages[ErrorCode.FILE_WRITE_ERROR]).toBe('Failed to write file');
      expect(ErrorMessages[ErrorCode.DIRECTORY_NOT_FOUND]).toBe('Directory not found');
      expect(ErrorMessages[ErrorCode.PERMISSION_DENIED]).toBe('Permission denied');
      expect(ErrorMessages[ErrorCode.PATH_ALREADY_EXISTS]).toBe('Path already exists');
    });

    it('should provide clear manifest error messages', () => {
      expect(ErrorMessages[ErrorCode.MANIFEST_NOT_FOUND]).toBe(
        'Manifest file (btw.yaml) not found'
      );
      expect(ErrorMessages[ErrorCode.MANIFEST_PARSE_ERROR]).toBe(
        'Failed to parse manifest file'
      );
      expect(ErrorMessages[ErrorCode.MANIFEST_VALIDATION_ERROR]).toBe(
        'Manifest validation failed'
      );
      expect(ErrorMessages[ErrorCode.MANIFEST_VERSION_UNSUPPORTED]).toBe(
        'Manifest version is not supported'
      );
    });

    it('should provide clear workflow error messages', () => {
      expect(ErrorMessages[ErrorCode.WORKFLOW_NOT_FOUND]).toBe('Workflow not found');
      expect(ErrorMessages[ErrorCode.WORKFLOW_ALREADY_EXISTS]).toBe(
        'Workflow already exists'
      );
      expect(ErrorMessages[ErrorCode.WORKFLOW_INVALID]).toBe('Workflow is invalid');
      expect(ErrorMessages[ErrorCode.WORKFLOW_INSTALLATION_FAILED]).toBe(
        'Failed to install workflow'
      );
      expect(ErrorMessages[ErrorCode.WORKFLOW_REMOVAL_FAILED]).toBe(
        'Failed to remove workflow'
      );
    });

    it('should provide clear injection error messages', () => {
      expect(ErrorMessages[ErrorCode.INJECTION_FAILED]).toBe('Failed to inject workflow');
      expect(ErrorMessages[ErrorCode.TARGET_NOT_SUPPORTED]).toBe(
        'AI target is not supported'
      );
      expect(ErrorMessages[ErrorCode.TARGET_CONFIG_NOT_FOUND]).toBe(
        'AI tool configuration file not found'
      );
      expect(ErrorMessages[ErrorCode.TARGET_CONFIG_INVALID]).toBe(
        'AI tool configuration is invalid'
      );
      expect(ErrorMessages[ErrorCode.BACKUP_FAILED]).toBe('Failed to create backup');
      expect(ErrorMessages[ErrorCode.RESTORE_FAILED]).toBe('Failed to restore from backup');
    });

    it('should provide clear state error messages', () => {
      expect(ErrorMessages[ErrorCode.STATE_NOT_FOUND]).toBe('BTW state not found');
      expect(ErrorMessages[ErrorCode.STATE_CORRUPTED]).toBe('BTW state is corrupted');
      expect(ErrorMessages[ErrorCode.STATE_WRITE_ERROR]).toBe('Failed to write BTW state');
      expect(ErrorMessages[ErrorCode.STATE_VERSION_MISMATCH]).toBe(
        'BTW state version mismatch'
      );
    });

    it('should provide clear git error messages', () => {
      expect(ErrorMessages[ErrorCode.GIT_NOT_FOUND]).toBe(
        'Git is not installed or not found in PATH'
      );
      expect(ErrorMessages[ErrorCode.GIT_CLONE_FAILED]).toBe(
        'Failed to clone git repository'
      );
      expect(ErrorMessages[ErrorCode.GIT_PULL_FAILED]).toBe(
        'Failed to pull git repository'
      );
      expect(ErrorMessages[ErrorCode.GIT_NOT_A_REPOSITORY]).toBe(
        'Directory is not a git repository'
      );
    });

    it('should provide clear network error messages', () => {
      expect(ErrorMessages[ErrorCode.NETWORK_ERROR]).toBe('Network error occurred');
      expect(ErrorMessages[ErrorCode.DOWNLOAD_FAILED]).toBe('Failed to download resource');
      expect(ErrorMessages[ErrorCode.REPOSITORY_NOT_FOUND]).toBe('Repository not found');
    });
  });
});

describe('ErrorHints', () => {
  it('should have hints for common errors', () => {
    // These are the most important errors to have hints for
    const importantErrors = [
      ErrorCode.FILE_NOT_FOUND,
      ErrorCode.PERMISSION_DENIED,
      ErrorCode.MANIFEST_NOT_FOUND,
      ErrorCode.MANIFEST_PARSE_ERROR,
      ErrorCode.MANIFEST_VALIDATION_ERROR,
      ErrorCode.WORKFLOW_NOT_FOUND,
      ErrorCode.WORKFLOW_ALREADY_EXISTS,
      ErrorCode.INJECTION_FAILED,
      ErrorCode.TARGET_NOT_SUPPORTED,
      ErrorCode.BACKUP_FAILED,
      ErrorCode.GIT_NOT_FOUND,
      ErrorCode.GIT_CLONE_FAILED,
      ErrorCode.STATE_CORRUPTED,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.REPOSITORY_NOT_FOUND,
    ];

    importantErrors.forEach((code) => {
      expect(ErrorHints[code]).toBeDefined();
      expect(typeof ErrorHints[code]).toBe('string');
      expect((ErrorHints[code] as string).length).toBeGreaterThan(0);
    });
  });

  it('should provide actionable hints', () => {
    // Hints should tell users what to do, not just describe the error
    Object.values(ErrorHints).forEach((hint) => {
      if (hint) {
        // Hints should be substantial (more than just a few words)
        expect(hint.length).toBeGreaterThan(20);
      }
    });
  });

  describe('specific hints', () => {
    it('should provide helpful file system hints', () => {
      expect(ErrorHints[ErrorCode.FILE_NOT_FOUND]).toContain('file');
      expect(ErrorHints[ErrorCode.PERMISSION_DENIED]).toContain('permission');
    });

    it('should provide helpful manifest hints', () => {
      expect(ErrorHints[ErrorCode.MANIFEST_NOT_FOUND]).toContain('btw.yaml');
      expect(ErrorHints[ErrorCode.MANIFEST_PARSE_ERROR]).toContain('YAML');
      expect(ErrorHints[ErrorCode.MANIFEST_VALIDATION_ERROR]).toContain('required fields');
    });

    it('should provide helpful workflow hints', () => {
      expect(ErrorHints[ErrorCode.WORKFLOW_NOT_FOUND]).toContain('btw list');
      expect(ErrorHints[ErrorCode.WORKFLOW_ALREADY_EXISTS]).toContain('--force');
    });

    it('should provide helpful injection hints', () => {
      expect(ErrorHints[ErrorCode.INJECTION_FAILED]).toContain('writable');
      expect(ErrorHints[ErrorCode.TARGET_NOT_SUPPORTED]).toContain('claude');
    });

    it('should provide helpful git hints', () => {
      expect(ErrorHints[ErrorCode.GIT_NOT_FOUND]).toContain('git-scm.com');
      expect(ErrorHints[ErrorCode.GIT_CLONE_FAILED]).toContain('network');
    });

    it('should provide helpful state hints', () => {
      expect(ErrorHints[ErrorCode.STATE_CORRUPTED]).toContain('state.json');
    });

    it('should provide helpful network hints', () => {
      expect(ErrorHints[ErrorCode.NETWORK_ERROR]).toContain('internet');
      expect(ErrorHints[ErrorCode.REPOSITORY_NOT_FOUND]).toContain('URL');
    });
  });
});

describe('BTWError', () => {
  describe('construction', () => {
    it('should create error with code only (using default message)', () => {
      const error = new BTWError(ErrorCode.FILE_NOT_FOUND);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BTWError);
      expect(error.name).toBe('BTWError');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.message).toBe(ErrorMessages[ErrorCode.FILE_NOT_FOUND]);
      expect(error.context).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should create error with custom message', () => {
      const customMessage = 'Custom error message for testing';
      const error = new BTWError(ErrorCode.FILE_NOT_FOUND, customMessage);

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.message).toBe(customMessage);
    });

    it('should create error with context', () => {
      const context = { path: '/test/path', operation: 'read' };
      const error = new BTWError(ErrorCode.FILE_READ_ERROR, undefined, { context });

      expect(error.code).toBe(ErrorCode.FILE_READ_ERROR);
      expect(error.message).toBe(ErrorMessages[ErrorCode.FILE_READ_ERROR]);
      expect(error.context).toEqual(context);
    });

    it('should create error with cause', () => {
      const originalError = new Error('Original error');
      const error = new BTWError(ErrorCode.FILE_READ_ERROR, 'Wrapper error', {
        cause: originalError,
      });

      expect(error.cause).toBe(originalError);
      expect(error.cause?.message).toBe('Original error');
    });

    it('should create error with all options', () => {
      const originalError = new Error('Root cause');
      const context = { file: 'test.txt', line: 42 };
      const customMessage = 'Comprehensive error';

      const error = new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, customMessage, {
        context,
        cause: originalError,
      });

      expect(error.code).toBe(ErrorCode.MANIFEST_PARSE_ERROR);
      expect(error.message).toBe(customMessage);
      expect(error.context).toEqual(context);
      expect(error.cause).toBe(originalError);
      expect(error.name).toBe('BTWError');
    });

    it('should have proper stack trace', () => {
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BTWError');
    });

    it('should preserve context immutability', () => {
      const context = { mutable: 'original' };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, undefined, { context });

      // Original context should not affect error context
      context.mutable = 'modified';

      // Note: The current implementation doesn't deep clone context
      // This test documents the current behavior
      expect(error.context?.mutable).toBe('modified');
    });
  });

  describe('error codes', () => {
    it('should work with all error codes', () => {
      const errorCodes = Object.values(ErrorCode);

      errorCodes.forEach((code) => {
        const error = new BTWError(code);
        expect(error.code).toBe(code);
        expect(error.message).toBe(ErrorMessages[code]);
      });
    });
  });

  describe('toString()', () => {
    it('should format basic error correctly', () => {
      const error = new BTWError(ErrorCode.FILE_NOT_FOUND);
      const result = error.toString();

      expect(result).toBe(`[${ErrorCode.FILE_NOT_FOUND}] ${ErrorMessages[ErrorCode.FILE_NOT_FOUND]}`);
    });

    it('should include context in string representation', () => {
      const context = { path: '/test/file.txt', size: 1024 };
      const error = new BTWError(ErrorCode.FILE_READ_ERROR, 'Test error', { context });
      const result = error.toString();

      expect(result).toContain('[E201] Test error');
      expect(result).toContain('Context:');
      expect(result).toContain('/test/file.txt');
      expect(result).toContain('1024');
    });

    it('should include cause in string representation', () => {
      const cause = new Error('Underlying cause');
      const error = new BTWError(ErrorCode.FILE_READ_ERROR, 'Wrapper error', { cause });
      const result = error.toString();

      expect(result).toContain('[E201] Wrapper error');
      expect(result).toContain('Caused by: Underlying cause');
    });

    it('should include both context and cause', () => {
      const context = { detail: 'test' };
      const cause = new Error('Root cause');
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Complex error', {
        context,
        cause,
      });
      const result = error.toString();

      expect(result).toContain('[E100] Complex error');
      expect(result).toContain('Context:');
      expect(result).toContain('test');
      expect(result).toContain('Caused by: Root cause');
    });

    it('should format context as pretty JSON', () => {
      const context = { key: 'value' };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context });
      const result = error.toString();

      // Should be pretty-printed (indented)
      expect(result).toContain('{\n');
    });
  });

  describe('toJSON()', () => {
    it('should serialize basic error correctly', () => {
      const error = new BTWError(ErrorCode.FILE_NOT_FOUND);
      const json = error.toJSON();

      expect(json.name).toBe('BTWError');
      expect(json.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(json.message).toBe(ErrorMessages[ErrorCode.FILE_NOT_FOUND]);
      expect(json.context).toBeUndefined();
      expect(json.cause).toBeUndefined();
      expect(json.stack).toBeDefined();
    });

    it('should serialize error with context', () => {
      const context = { path: '/test', data: [1, 2, 3] };
      const error = new BTWError(ErrorCode.FILE_WRITE_ERROR, 'Custom', { context });
      const json = error.toJSON();

      expect(json.context).toEqual(context);
    });

    it('should serialize cause as message string', () => {
      const cause = new Error('Original error message');
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Wrapper', { cause });
      const json = error.toJSON();

      expect(json.cause).toBe('Original error message');
    });

    it('should be valid JSON (round-trip)', () => {
      const context = { nested: { deep: 'value' }, array: [1, 2, 3] };
      const cause = new Error('Cause');
      const error = new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, 'Test', {
        context,
        cause,
      });

      const json = error.toJSON();
      const stringified = JSON.stringify(json);
      const parsed = JSON.parse(stringified);

      expect(parsed.name).toBe('BTWError');
      expect(parsed.code).toBe(ErrorCode.MANIFEST_PARSE_ERROR);
      expect(parsed.message).toBe('Test');
      expect(parsed.context).toEqual(context);
      expect(parsed.cause).toBe('Cause');
    });

    it('should handle complex context objects', () => {
      const context = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', { three: 3 }],
        nested: { a: { b: { c: 'deep' } } },
      };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Complex', { context });
      const json = error.toJSON();

      expect(json.context).toEqual(context);
    });
  });

  describe('isBTWError()', () => {
    it('should return true for BTWError instances', () => {
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR);
      expect(BTWError.isBTWError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(BTWError.isBTWError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(BTWError.isBTWError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(BTWError.isBTWError(undefined)).toBe(false);
    });

    it('should return false for strings', () => {
      expect(BTWError.isBTWError('error')).toBe(false);
    });

    it('should return false for objects that look like BTWError', () => {
      const fakeBTWError = {
        name: 'BTWError',
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Fake error',
      };
      expect(BTWError.isBTWError(fakeBTWError)).toBe(false);
    });

    it('should return false for other error types', () => {
      expect(BTWError.isBTWError(new TypeError('type error'))).toBe(false);
      expect(BTWError.isBTWError(new RangeError('range error'))).toBe(false);
      expect(BTWError.isBTWError(new SyntaxError('syntax error'))).toBe(false);
    });

    it('should work as type guard', () => {
      const maybeError: unknown = new BTWError(ErrorCode.FILE_NOT_FOUND);

      if (BTWError.isBTWError(maybeError)) {
        // TypeScript should allow access to BTWError properties
        expect(maybeError.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(maybeError.name).toBe('BTWError');
      } else {
        throw new Error('Should have been a BTWError');
      }
    });
  });

  describe('wrap()', () => {
    it('should return BTWError unchanged', () => {
      const original = new BTWError(ErrorCode.FILE_NOT_FOUND, 'Original');
      const wrapped = BTWError.wrap(original);

      expect(wrapped).toBe(original);
      expect(wrapped.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(wrapped.message).toBe('Original');
    });

    it('should wrap regular Error with default code', () => {
      const original = new Error('Regular error');
      const wrapped = BTWError.wrap(original);

      expect(wrapped).toBeInstanceOf(BTWError);
      expect(wrapped.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(wrapped.message).toBe('Regular error');
      expect(wrapped.cause).toBe(original);
    });

    it('should wrap regular Error with specified code', () => {
      const original = new Error('File error');
      const wrapped = BTWError.wrap(original, ErrorCode.FILE_READ_ERROR);

      expect(wrapped.code).toBe(ErrorCode.FILE_READ_ERROR);
      expect(wrapped.message).toBe('File error');
      expect(wrapped.cause).toBe(original);
    });

    it('should wrap string error', () => {
      const wrapped = BTWError.wrap('String error message');

      expect(wrapped).toBeInstanceOf(BTWError);
      expect(wrapped.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(wrapped.message).toBe('String error message');
      expect(wrapped.cause).toBeInstanceOf(Error);
      expect(wrapped.cause?.message).toBe('String error message');
    });

    it('should wrap number error', () => {
      const wrapped = BTWError.wrap(42);

      expect(wrapped).toBeInstanceOf(BTWError);
      expect(wrapped.message).toBe('42');
    });

    it('should wrap object error', () => {
      const wrapped = BTWError.wrap({ error: 'object' });

      expect(wrapped).toBeInstanceOf(BTWError);
      expect(wrapped.message).toBe('[object Object]');
    });

    it('should wrap TypeError', () => {
      const original = new TypeError('Type error');
      const wrapped = BTWError.wrap(original, ErrorCode.INVALID_ARGUMENT);

      expect(wrapped.code).toBe(ErrorCode.INVALID_ARGUMENT);
      expect(wrapped.cause).toBe(original);
      expect(wrapped.cause).toBeInstanceOf(TypeError);
    });

    it('should preserve original error properties when wrapping', () => {
      const original = new Error('Original');
      original.name = 'CustomError';
      const wrapped = BTWError.wrap(original);

      expect(wrapped.cause?.name).toBe('CustomError');
    });
  });

  describe('error chaining', () => {
    it('should support multiple levels of chaining', () => {
      const level1 = new Error('Root cause');
      const level2 = new BTWError(ErrorCode.FILE_READ_ERROR, 'File read failed', {
        cause: level1,
      });
      const level3 = new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, 'Manifest load failed', {
        cause: level2,
      });

      expect(level3.cause).toBe(level2);
      expect((level3.cause as BTWError).cause).toBe(level1);
    });

    it('should preserve error chain in toString()', () => {
      const cause = new Error('Deep cause');
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Surface error', { cause });
      const result = error.toString();

      expect(result).toContain('Surface error');
      expect(result).toContain('Caused by: Deep cause');
    });

    it('should handle BTWError as cause', () => {
      const innerError = new BTWError(ErrorCode.FILE_NOT_FOUND, 'Inner');
      const outerError = new BTWError(ErrorCode.MANIFEST_NOT_FOUND, 'Outer', {
        cause: innerError,
      });

      expect(outerError.cause).toBe(innerError);
      expect(outerError.cause).toBeInstanceOf(BTWError);

      const result = outerError.toString();
      expect(result).toContain('Caused by: Inner');
    });
  });

  describe('context preservation', () => {
    it('should preserve simple context', () => {
      const context = { key: 'value' };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context });

      expect(error.context).toEqual(context);
    });

    it('should preserve complex nested context', () => {
      const context = {
        operation: 'inject',
        target: 'claude',
        paths: {
          source: '/src/workflow',
          destination: '/home/user/.claude',
        },
        metadata: {
          timestamp: '2024-01-01T00:00:00Z',
          version: '1.0.0',
          tags: ['production', 'tested'],
        },
      };
      const error = new BTWError(ErrorCode.INJECTION_FAILED, 'Injection failed', {
        context,
      });

      expect(error.context).toEqual(context);
    });

    it('should preserve context with various types', () => {
      const context = {
        string: 'text',
        number: 42,
        float: 3.14,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' },
      };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context });

      expect(error.context).toEqual(context);
    });

    it('should include context in JSON serialization', () => {
      const context = { important: 'data' };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context });
      const json = error.toJSON();

      expect(json.context).toEqual(context);
    });

    it('should handle empty context object', () => {
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context: {} });

      expect(error.context).toEqual({});
    });

    it('should handle context with undefined values', () => {
      const context = { defined: 'value', notDefined: undefined };
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context });

      expect(error.context).toEqual(context);
    });
  });

  describe('inheritance', () => {
    it('should be catchable as Error', () => {
      let caught: Error | null = null;

      try {
        throw new BTWError(ErrorCode.UNKNOWN_ERROR);
      } catch (error) {
        if (error instanceof Error) {
          caught = error;
        }
      }

      expect(caught).not.toBeNull();
      expect(caught).toBeInstanceOf(BTWError);
    });

    it('should work with Promise rejection', async () => {
      const promise = Promise.reject(new BTWError(ErrorCode.FILE_NOT_FOUND));

      await expect(promise).rejects.toBeInstanceOf(BTWError);
      await expect(promise).rejects.toHaveProperty('code', ErrorCode.FILE_NOT_FOUND);
    });

    it('should have correct prototype chain', () => {
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR);

      expect(Object.getPrototypeOf(error)).toBe(BTWError.prototype);
      expect(Object.getPrototypeOf(BTWError.prototype)).toBe(Error.prototype);
    });
  });

  describe('edge cases', () => {
    it('should fall back to default message when empty string is provided', () => {
      // Note: The implementation uses || operator, so empty string falls back to default
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, '');

      expect(error.message).toBe(ErrorMessages[ErrorCode.UNKNOWN_ERROR]);
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, longMessage);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Error with "quotes", <brackets>, and unicode \u00e9\u00e8';
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, specialMessage);

      expect(error.message).toBe(specialMessage);
    });

    it('should handle context with circular reference in toJSON gracefully', () => {
      // Note: This tests the current behavior, which will throw on JSON.stringify
      // The implementation might need to handle this case
      const context: Record<string, unknown> = { a: 'value' };
      context.self = context; // Circular reference

      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, 'Test', { context });

      // toJSON returns the raw context, so circular ref exists
      expect(error.toJSON().context).toBe(context);

      // But JSON.stringify will fail
      expect(() => JSON.stringify(error.toJSON())).toThrow();
    });

    it('should handle newlines in message', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const error = new BTWError(ErrorCode.UNKNOWN_ERROR, message);

      expect(error.message).toBe(message);
      expect(error.toString()).toContain('Line 1\nLine 2\nLine 3');
    });
  });
});

describe('integration tests', () => {
  describe('error flow simulation', () => {
    it('should simulate file operation error flow', () => {
      // Simulate a file system error being wrapped and enhanced
      const fsError = new Error('ENOENT: no such file or directory');
      const btwError = BTWError.wrap(fsError, ErrorCode.FILE_NOT_FOUND);

      expect(btwError.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(btwError.cause).toBe(fsError);
      expect(ErrorHints[btwError.code]).toBeDefined();
    });

    it('should simulate manifest loading error flow', () => {
      // Simulate YAML parse error -> BTW manifest error
      const yamlError = new Error('Invalid YAML at line 5');
      const parseError = new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, 'Failed to parse btw.yaml', {
        cause: yamlError,
        context: { file: '/project/btw.yaml', line: 5 },
      });

      expect(parseError.code).toBe(ErrorCode.MANIFEST_PARSE_ERROR);
      expect(parseError.context?.file).toBe('/project/btw.yaml');
      expect(parseError.cause?.message).toContain('Invalid YAML');
    });

    it('should simulate injection error flow', () => {
      // Simulate permission denied -> injection failed
      const permError = new BTWError(ErrorCode.PERMISSION_DENIED, 'Cannot write to config', {
        context: { path: '/home/user/.claude/config.json' },
      });

      const injectionError = new BTWError(
        ErrorCode.INJECTION_FAILED,
        'Workflow injection failed due to permissions',
        {
          cause: permError,
          context: {
            workflow: 'my-workflow',
            target: 'claude',
          },
        }
      );

      expect(injectionError.code).toBe(ErrorCode.INJECTION_FAILED);
      expect((injectionError.cause as BTWError).code).toBe(ErrorCode.PERMISSION_DENIED);

      const errorString = injectionError.toString();
      expect(errorString).toContain('injection failed');
      expect(errorString).toContain('permissions');
    });
  });

  describe('error handling patterns', () => {
    it('should support try-catch with type narrowing', () => {
      function riskyOperation(): void {
        throw new BTWError(ErrorCode.WORKFLOW_NOT_FOUND, 'Workflow xyz not found');
      }

      try {
        riskyOperation();
      } catch (error) {
        if (BTWError.isBTWError(error)) {
          expect(error.code).toBe(ErrorCode.WORKFLOW_NOT_FOUND);
        } else {
          throw new Error('Expected BTWError');
        }
      }
    });

    it('should support error code checking', () => {
      const error = new BTWError(ErrorCode.FILE_NOT_FOUND);

      // Check for specific error codes
      if (error.code === ErrorCode.FILE_NOT_FOUND) {
        expect(true).toBe(true); // Test passes
      }

      // Check for error category (2xx = file system errors)
      const codeNum = parseInt(error.code.slice(1));
      const isFileSystemError = codeNum >= 200 && codeNum < 300;
      expect(isFileSystemError).toBe(true);
    });

    it('should support logging error details', () => {
      const error = new BTWError(ErrorCode.GIT_CLONE_FAILED, 'Clone failed', {
        context: { repo: 'https://github.com/user/repo', branch: 'main' },
        cause: new Error('Network timeout'),
      });

      const logOutput = error.toJSON();

      expect(logOutput).toHaveProperty('name', 'BTWError');
      expect(logOutput).toHaveProperty('code', 'E701');
      expect(logOutput).toHaveProperty('message', 'Clone failed');
      expect(logOutput).toHaveProperty('context');
      expect(logOutput).toHaveProperty('cause', 'Network timeout');
      expect(logOutput).toHaveProperty('stack');
    });
  });
});
