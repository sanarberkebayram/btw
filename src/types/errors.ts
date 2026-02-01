/**
 * BTW - Error Handling
 * Custom error classes and error codes for the BTW system
 */

/**
 * Error codes for BTW operations
 */
export enum ErrorCode {
  // General errors (1xx)
  UNKNOWN_ERROR = 'E100',
  INVALID_ARGUMENT = 'E101',
  OPERATION_CANCELLED = 'E102',
  INVALID_INPUT = 'E103',

  // File system errors (2xx)
  FILE_NOT_FOUND = 'E200',
  FILE_READ_ERROR = 'E201',
  FILE_WRITE_ERROR = 'E202',
  DIRECTORY_NOT_FOUND = 'E203',
  PERMISSION_DENIED = 'E204',
  PATH_ALREADY_EXISTS = 'E205',

  // Manifest errors (3xx)
  MANIFEST_NOT_FOUND = 'E300',
  MANIFEST_PARSE_ERROR = 'E301',
  MANIFEST_VALIDATION_ERROR = 'E302',
  MANIFEST_VERSION_UNSUPPORTED = 'E303',

  // Workflow errors (4xx)
  WORKFLOW_NOT_FOUND = 'E400',
  WORKFLOW_ALREADY_EXISTS = 'E401',
  WORKFLOW_INVALID = 'E402',
  WORKFLOW_INSTALLATION_FAILED = 'E403',
  WORKFLOW_REMOVAL_FAILED = 'E404',

  // Injection errors (5xx)
  INJECTION_FAILED = 'E500',
  TARGET_NOT_SUPPORTED = 'E501',
  TARGET_CONFIG_NOT_FOUND = 'E502',
  TARGET_CONFIG_INVALID = 'E503',
  BACKUP_FAILED = 'E504',
  RESTORE_FAILED = 'E505',

  // State errors (6xx)
  STATE_NOT_FOUND = 'E600',
  STATE_CORRUPTED = 'E601',
  STATE_WRITE_ERROR = 'E602',
  STATE_VERSION_MISMATCH = 'E603',

  // Git errors (7xx)
  GIT_NOT_FOUND = 'E700',
  GIT_CLONE_FAILED = 'E701',
  GIT_PULL_FAILED = 'E702',
  GIT_NOT_A_REPOSITORY = 'E703',

  // Network errors (8xx)
  NETWORK_ERROR = 'E800',
  DOWNLOAD_FAILED = 'E801',
  REPOSITORY_NOT_FOUND = 'E802',
}

/**
 * Human-readable error messages for each error code
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred',
  [ErrorCode.INVALID_ARGUMENT]: 'Invalid argument provided',
  [ErrorCode.OPERATION_CANCELLED]: 'Operation was cancelled',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',

  [ErrorCode.FILE_NOT_FOUND]: 'File not found',
  [ErrorCode.FILE_READ_ERROR]: 'Failed to read file',
  [ErrorCode.FILE_WRITE_ERROR]: 'Failed to write file',
  [ErrorCode.DIRECTORY_NOT_FOUND]: 'Directory not found',
  [ErrorCode.PERMISSION_DENIED]: 'Permission denied',
  [ErrorCode.PATH_ALREADY_EXISTS]: 'Path already exists',

  [ErrorCode.MANIFEST_NOT_FOUND]: 'Manifest file (btw.yaml) not found',
  [ErrorCode.MANIFEST_PARSE_ERROR]: 'Failed to parse manifest file',
  [ErrorCode.MANIFEST_VALIDATION_ERROR]: 'Manifest validation failed',
  [ErrorCode.MANIFEST_VERSION_UNSUPPORTED]: 'Manifest version is not supported',

  [ErrorCode.WORKFLOW_NOT_FOUND]: 'Workflow not found',
  [ErrorCode.WORKFLOW_ALREADY_EXISTS]: 'Workflow already exists',
  [ErrorCode.WORKFLOW_INVALID]: 'Workflow is invalid',
  [ErrorCode.WORKFLOW_INSTALLATION_FAILED]: 'Failed to install workflow',
  [ErrorCode.WORKFLOW_REMOVAL_FAILED]: 'Failed to remove workflow',

  [ErrorCode.INJECTION_FAILED]: 'Failed to inject workflow',
  [ErrorCode.TARGET_NOT_SUPPORTED]: 'AI target is not supported',
  [ErrorCode.TARGET_CONFIG_NOT_FOUND]: 'AI tool configuration file not found',
  [ErrorCode.TARGET_CONFIG_INVALID]: 'AI tool configuration is invalid',
  [ErrorCode.BACKUP_FAILED]: 'Failed to create backup',
  [ErrorCode.RESTORE_FAILED]: 'Failed to restore from backup',

  [ErrorCode.STATE_NOT_FOUND]: 'BTW state not found',
  [ErrorCode.STATE_CORRUPTED]: 'BTW state is corrupted',
  [ErrorCode.STATE_WRITE_ERROR]: 'Failed to write BTW state',
  [ErrorCode.STATE_VERSION_MISMATCH]: 'BTW state version mismatch',

  [ErrorCode.GIT_NOT_FOUND]: 'Git is not installed or not found in PATH',
  [ErrorCode.GIT_CLONE_FAILED]: 'Failed to clone git repository',
  [ErrorCode.GIT_PULL_FAILED]: 'Failed to pull git repository',
  [ErrorCode.GIT_NOT_A_REPOSITORY]: 'Directory is not a git repository',

  [ErrorCode.NETWORK_ERROR]: 'Network error occurred',
  [ErrorCode.DOWNLOAD_FAILED]: 'Failed to download resource',
  [ErrorCode.REPOSITORY_NOT_FOUND]: 'Repository not found',
};

/**
 * Helpful hints for resolving errors
 */
export const ErrorHints: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.FILE_NOT_FOUND]: 'Check if the file path is correct and the file exists.',
  [ErrorCode.PERMISSION_DENIED]: 'Try running with elevated permissions or check file ownership.',
  [ErrorCode.MANIFEST_NOT_FOUND]: 'Ensure the workflow contains a btw.yaml file in its root directory.',
  [ErrorCode.MANIFEST_PARSE_ERROR]: 'Check the btw.yaml file for YAML syntax errors.',
  [ErrorCode.MANIFEST_VALIDATION_ERROR]: 'Verify all required fields are present in btw.yaml (version, id, name, description, targets, agents).',
  [ErrorCode.WORKFLOW_NOT_FOUND]: 'Run `btw list` to see installed workflows.',
  [ErrorCode.WORKFLOW_ALREADY_EXISTS]: 'Use --force flag to overwrite the existing workflow.',
  [ErrorCode.INJECTION_FAILED]: 'Check if the target AI tool configuration directory is writable.',
  [ErrorCode.TARGET_NOT_SUPPORTED]: 'Currently supported targets: claude. More coming soon!',
  [ErrorCode.BACKUP_FAILED]: 'Ensure you have write permissions in the project directory.',
  [ErrorCode.GIT_NOT_FOUND]: 'Install git from https://git-scm.com/ and ensure it is in your PATH.',
  [ErrorCode.GIT_CLONE_FAILED]: 'Check the repository URL and your network connection.',
  [ErrorCode.STATE_CORRUPTED]: 'Try running `btw list` or delete ~/.btw/state.json to reset.',
  [ErrorCode.NETWORK_ERROR]: 'Check your internet connection and try again.',
  [ErrorCode.REPOSITORY_NOT_FOUND]: 'Verify the repository URL or owner/repo format is correct.',
};

/**
 * Custom error class for BTW-specific errors
 */
export class BTWError extends Error {
  /** Error code for programmatic handling */
  public readonly code: ErrorCode;

  /** Additional context about the error */
  public readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    const finalMessage = message || ErrorMessages[code];
    super(finalMessage);

    this.name = 'BTWError';
    this.code = code;
    this.context = options?.context;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BTWError);
    }
  }

  /**
   * Create a string representation of the error
   */
  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    if (this.context) {
      result += `\nContext: ${JSON.stringify(this.context, null, 2)}`;
    }
    if (this.cause) {
      result += `\nCaused by: ${this.cause.message}`;
    }
    return result;
  }

  /**
   * Convert error to a plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }

  /**
   * Check if an unknown error is a BTWError
   */
  static isBTWError(error: unknown): error is BTWError {
    return error instanceof BTWError;
  }

  /**
   * Wrap an unknown error as a BTWError
   */
  static wrap(error: unknown, code: ErrorCode = ErrorCode.UNKNOWN_ERROR): BTWError {
    if (BTWError.isBTWError(error)) {
      return error;
    }

    const originalError = error instanceof Error ? error : new Error(String(error));
    return new BTWError(code, originalError.message, { cause: originalError });
  }
}
