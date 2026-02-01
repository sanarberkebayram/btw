/**
 * BTW - CLI Output Utilities
 * Console output formatting with chalk
 */

import chalk from 'chalk';
import { BTWError, ErrorCode, ErrorHints } from '../../types/errors.js';

/**
 * Log level for output
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

/**
 * Output options
 */
export interface OutputOptions {
  /** Disable colors */
  noColor?: boolean;
  /** Quiet mode - only errors */
  quiet?: boolean;
  /** Verbose mode - include debug */
  verbose?: boolean;
}

/**
 * Console output formatter for BTW CLI
 */
export class Output {
  private options: OutputOptions;

  constructor(options: OutputOptions = {}) {
    this.options = options;

    // Check environment for no-color preference
    if (process.env.NO_COLOR || process.env.BTW_NO_COLOR) {
      this.options.noColor = true;
    }
  }

  /**
   * Print a success message
   * @param message - Message to print
   */
  success(message: string): void {
    if (this.options.quiet) return;
    const prefix = this.options.noColor ? '[OK]' : chalk.green('✓');
    console.log(`${prefix} ${message}`);
  }

  /**
   * Print an error message
   * @param message - Message to print
   */
  error(message: string): void {
    const prefix = this.options.noColor ? '[ERROR]' : chalk.red('✗');
    console.error(`${prefix} ${message}`);
  }

  /**
   * Print a warning message
   * @param message - Message to print
   */
  warn(message: string): void {
    if (this.options.quiet) return;
    const prefix = this.options.noColor ? '[WARN]' : chalk.yellow('⚠');
    console.warn(`${prefix} ${message}`);
  }

  /**
   * Print an info message
   * @param message - Message to print
   */
  info(message: string): void {
    if (this.options.quiet) return;
    const prefix = this.options.noColor ? '[INFO]' : chalk.blue('ℹ');
    console.log(`${prefix} ${message}`);
  }

  /**
   * Print a debug message (only in verbose mode)
   * @param message - Message to print
   */
  debug(message: string): void {
    if (!this.options.verbose) return;
    const prefix = this.options.noColor ? '[DEBUG]' : chalk.gray('→');
    console.log(`${prefix} ${message}`);
  }

  /**
   * Print a plain message (no prefix)
   * @param message - Message to print
   */
  log(message: string): void {
    if (this.options.quiet) return;
    console.log(message);
  }

  /**
   * Print an empty line
   */
  newline(): void {
    if (this.options.quiet) return;
    console.log();
  }

  /**
   * Print a header/title
   * @param title - Title to print
   */
  header(title: string): void {
    if (this.options.quiet) return;
    const text = this.options.noColor ? `=== ${title} ===` : chalk.bold.cyan(title);
    console.log(text);
  }

  /**
   * Print a divider line
   */
  divider(): void {
    if (this.options.quiet) return;
    const line = '─'.repeat(40);
    console.log(this.options.noColor ? line : chalk.gray(line));
  }

  /**
   * Print a key-value pair
   * @param key - Key label
   * @param value - Value to display
   */
  keyValue(key: string, value: string): void {
    if (this.options.quiet) return;
    const keyText = this.options.noColor ? `${key}:` : chalk.gray(`${key}:`);
    console.log(`  ${keyText} ${value}`);
  }

  /**
   * Print a list item
   * @param item - Item text
   * @param indent - Indentation level
   */
  listItem(item: string, indent: number = 0): void {
    if (this.options.quiet) return;
    const spaces = '  '.repeat(indent);
    const bullet = this.options.noColor ? '-' : chalk.gray('•');
    console.log(`${spaces}${bullet} ${item}`);
  }

  /**
   * Print a table (simple implementation)
   * @param headers - Column headers
   * @param rows - Data rows
   */
  table(headers: string[], rows: string[][]): void {
    if (this.options.quiet) return;

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxRow = Math.max(...rows.map((r) => (r[i] || '').length));
      return Math.max(h.length, maxRow);
    });

    // Print header
    const headerRow = headers.map((h, i) => h.padEnd(widths[i] ?? 0)).join('  ');
    console.log(this.options.noColor ? headerRow : chalk.bold(headerRow));

    // Print separator
    const separator = widths.map((w) => '─'.repeat(w)).join('──');
    console.log(this.options.noColor ? separator : chalk.gray(separator));

    // Print rows
    for (const row of rows) {
      const rowText = row.map((cell, i) => (cell || '').padEnd(widths[i] ?? 0)).join('  ');
      console.log(rowText);
    }
  }

  /**
   * Format a path for display
   * @param path - Path to format
   */
  formatPath(path: string): string {
    return this.options.noColor ? path : chalk.cyan(path);
  }

  /**
   * Format a workflow ID for display
   * @param id - Workflow ID
   */
  formatWorkflowId(id: string): string {
    return this.options.noColor ? id : chalk.yellow(id);
  }

  /**
   * Format a command for display
   * @param command - Command string
   */
  formatCommand(command: string): string {
    return this.options.noColor ? `\`${command}\`` : chalk.cyan(`\`${command}\``);
  }

  /**
   * Create a spinner (placeholder - would use ora in real implementation)
   * @param message - Spinner message
   */
  spinner(message: string): { stop: (success?: boolean) => void } {
    // TODO: Implement real spinner using ora
    this.info(message + '...');
    return {
      stop: (success = true) => {
        if (success) {
          this.success(message);
        } else {
          this.error(message);
        }
      },
    };
  }

  /**
   * Format and print a BTWError with context and hints
   * @param error - The BTWError to format
   */
  formatError(error: BTWError): void {
    // Print main error
    this.error(`[${error.code}] ${error.message}`);

    // Print context if available
    if (error.context && Object.keys(error.context).length > 0) {
      for (const [key, value] of Object.entries(error.context)) {
        this.keyValue(`  ${key}`, String(value));
      }
    }

    // Print cause if available
    if (error.cause) {
      const causeMsg = this.options.noColor ? 'Caused by:' : chalk.gray('Caused by:');
      console.error(`  ${causeMsg} ${error.cause.message}`);
    }

    // Print hint if available
    const hint = ErrorHints[error.code];
    if (hint) {
      this.newline();
      this.hint(hint);
    }
  }

  /**
   * Print a hint message
   * @param message - Hint message
   */
  hint(message: string): void {
    const prefix = this.options.noColor ? 'Hint:' : chalk.cyan('💡 Hint:');
    console.log(`${prefix} ${message}`);
  }

  /**
   * Print an error with a custom hint
   * @param message - Error message
   * @param hint - Hint for resolving the error
   */
  errorWithHint(message: string, hint: string): void {
    this.error(message);
    this.hint(hint);
  }
}

/**
 * Default output instance
 */
export const output = new Output();

/**
 * Create a new output instance with options
 * @param options - Output options
 */
export function createOutput(options: OutputOptions): Output {
  return new Output(options);
}
