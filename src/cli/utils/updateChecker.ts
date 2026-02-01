/**
 * BTW - Update Checker Utility
 * Checks for newer versions and prompts user to update
 */

import { execSync } from 'child_process';
import * as readline from 'readline';
import chalk from 'chalk';
import semver from 'semver';

const PACKAGE_NAME = '@sanarberkebayram/btw';
const FETCH_TIMEOUT = 5000; // 5 seconds
const PROMPT_TIMEOUT = 30000; // 30 seconds

/**
 * Fetch the latest version from npm registry with timeout
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.version || null;
  } catch {
    // Silently fail - network issues shouldn't block CLI usage
    return null;
  }
}

/**
 * Prompt user for confirmation with timeout
 */
function askUser(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Set a timeout to auto-skip if no response
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(chalk.gray('\n  No response, skipping update.'));
        rl.close();
        resolve(false);
      }
    }, PROMPT_TIMEOUT);

    rl.question(question, (answer) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        rl.close();
        const normalized = answer.toLowerCase().trim();
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });

    // Handle close event (e.g., Ctrl+C)
    rl.on('close', () => {
      clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    // Handle errors
    rl.on('error', () => {
      clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
  });
}

/**
 * Run the update command
 */
function runUpdate(): boolean {
  try {
    console.log(chalk.blue('ℹ'), 'Updating BTW...\n');
    execSync(`npm install -g ${PACKAGE_NAME}@latest`, {
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout
    });
    console.log();
    console.log(chalk.green('✓'), 'BTW has been updated successfully!');
    console.log(chalk.gray('  Please restart BTW to use the new version.\n'));
    return true;
  } catch {
    console.error(chalk.red('✗'), 'Failed to update BTW.');
    console.log(chalk.cyan('💡 Hint:'), `Try running manually: npm install -g ${PACKAGE_NAME}@latest\n`);
    return false;
  }
}

/**
 * Check for updates and prompt user if newer version exists
 * @param currentVersion - Current installed version
 * @returns true if user chose to update and update was initiated
 */
export async function checkForUpdates(currentVersion: string): Promise<boolean> {
  // Skip in CI environments or when explicitly disabled
  if (process.env.CI || process.env.BTW_SKIP_UPDATE_CHECK) {
    return false;
  }

  // Skip if not running in a TTY (e.g., piped output)
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  try {
    const latestVersion = await getLatestVersion();

    if (!latestVersion) {
      return false;
    }

    // Compare versions
    if (!semver.gt(latestVersion, currentVersion)) {
      return false;
    }

    // Newer version available
    console.log();
    console.log(
      chalk.yellow('⚠'),
      chalk.yellow(`A new version of BTW is available: ${chalk.green(latestVersion)} (current: ${currentVersion})`)
    );

    const shouldUpdate = await askUser(chalk.cyan('  Would you like to update now? (y/N): '));

    if (shouldUpdate) {
      const success = runUpdate();
      if (success) {
        process.exit(0);
      }
      return true;
    } else {
      console.log(chalk.gray(`  Skipped. Run 'npm install -g ${PACKAGE_NAME}@latest' to update manually.\n`));
      return false;
    }
  } catch {
    // Silently fail - don't interrupt user's workflow
    return false;
  }
}
