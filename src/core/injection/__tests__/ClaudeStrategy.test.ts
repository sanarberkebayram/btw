/**
 * BTW - ClaudeStrategy Unit Tests
 * Comprehensive tests for Claude Code injection strategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeStrategy } from '../strategies/ClaudeStrategy.js';
import { Manifest, AITarget } from '../../../types/index.js';
import { BTWError, ErrorCode } from '../../../types/errors.js';
import { InjectOptions, EjectOptions, InjectionStatus } from '../strategies/InjectionStrategy.js';

// Mock the file system
vi.mock('../../../infrastructure/fs/FileSystem.js', () => ({
  fileSystem: {
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    remove: vi.fn(),
    backup: vi.fn(),
    restore: vi.fn(),
  },
}));

// Mock the path resolver
vi.mock('../../../infrastructure/fs/PathResolver.js', () => ({
  pathResolver: {
    resolveAiToolPaths: vi.fn((projectRoot: string) => ({
      configPath: `${projectRoot}/.claude/settings.json`,
      instructionsPath: `${projectRoot}/.claude/instructions.md`,
      projectConfigPath: `${projectRoot}/.claude/project.json`,
    })),
    normalize: vi.fn((path: string) => path),
  },
}));

// Import mocked modules for manipulation
import { fileSystem } from '../../../infrastructure/fs/FileSystem.js';

/**
 * BTW markers used in content
 */
const BTW_START_MARKER = '<!-- BTW_START -->';
const BTW_END_MARKER = '<!-- BTW_END -->';

/**
 * Create a test manifest
 */
function createTestManifest(overrides?: Partial<Manifest>): Manifest {
  return {
    version: '1.0',
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow for unit tests',
    targets: ['claude'] as AITarget[],
    agents: [
      {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent for testing',
        systemPrompt: 'You are a test agent. Follow these instructions carefully.',
        tags: ['test', 'demo'],
      },
    ],
    author: 'Test Author',
    repository: 'https://github.com/test/workflow',
    ...overrides,
  };
}

/**
 * Create a valid BTW marker comment
 */
function createBtwMarker(workflowId: string, timestamp?: string): string {
  const ts = timestamp || new Date().toISOString();
  return `<!-- BTW:${workflowId}:${ts} -->`;
}

/**
 * Create mock BTW content
 */
function createMockBtwContent(workflowId: string = 'test-workflow'): string {
  return `${BTW_START_MARKER}
${createBtwMarker(workflowId)}

# Test Workflow

A test workflow

${BTW_END_MARKER}`;
}

describe('ClaudeStrategy', () => {
  let strategy: ClaudeStrategy;
  const projectRoot = '/test/project';
  const instructionsPath = `${projectRoot}/.claude/instructions.md`;
  const backupPath = `${instructionsPath}.btw-backup`;
  const claudeDir = `${projectRoot}/.claude`;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new ClaudeStrategy();

    // Default mock implementations
    vi.mocked(fileSystem.exists).mockResolvedValue(false);
    vi.mocked(fileSystem.readFile).mockResolvedValue('');
    vi.mocked(fileSystem.writeFile).mockResolvedValue(undefined);
    vi.mocked(fileSystem.mkdir).mockResolvedValue(undefined);
    vi.mocked(fileSystem.remove).mockResolvedValue(undefined);
    vi.mocked(fileSystem.backup).mockResolvedValue(backupPath);
    vi.mocked(fileSystem.restore).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('target property', () => {
    it('should have target set to "claude"', () => {
      expect(strategy.target).toBe('claude');
    });
  });

  describe('canHandle()', () => {
    it('should return true for claude target', () => {
      expect(strategy.canHandle('claude')).toBe(true);
    });

    it('should return false for other targets', () => {
      expect(strategy.canHandle('cursor')).toBe(false);
      expect(strategy.canHandle('windsurf')).toBe(false);
      expect(strategy.canHandle('copilot')).toBe(false);
    });
  });

  describe('inject()', () => {
    const options: InjectOptions = { projectRoot };

    describe('successful injection', () => {
      it('should create .claude directory if it does not exist', async () => {
        const manifest = createTestManifest();

        await strategy.inject(manifest, options);

        expect(fileSystem.mkdir).toHaveBeenCalledWith(claudeDir);
      });

      it('should write instructions file', async () => {
        const manifest = createTestManifest();

        await strategy.inject(manifest, options);

        expect(fileSystem.writeFile).toHaveBeenCalledWith(
          instructionsPath,
          expect.any(String),
          { createDirs: true }
        );
      });

      it('should return correct injection result', async () => {
        const manifest = createTestManifest();

        const result = await strategy.inject(manifest, options);

        expect(result.target).toBe('claude');
        expect(result.configPath).toBe(instructionsPath);
        expect(result.agentCount).toBe(1);
        expect(result.backupCreated).toBe(false);
      });

      it('should handle manifest with multiple agents', async () => {
        const manifest = createTestManifest({
          agents: [
            { id: 'agent1', name: 'Agent 1', description: 'First', systemPrompt: 'Prompt 1' },
            { id: 'agent2', name: 'Agent 2', description: 'Second', systemPrompt: 'Prompt 2' },
          ],
        });

        const result = await strategy.inject(manifest, options);

        expect(result.agentCount).toBe(2);
      });
    });

    describe('backup functionality', () => {
      it('should create backup when backup option is true and file exists', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        vi.mocked(fileSystem.readFile).mockResolvedValue('existing content');

        const manifest = createTestManifest();

        const result = await strategy.inject(manifest, {
          ...options,
          backup: true,
        });

        expect(fileSystem.backup).toHaveBeenCalledWith(instructionsPath);
        expect(result.backupCreated).toBe(true);
        expect(result.backupPath).toBe(backupPath);
      });

      it('should not create backup when backup option is false', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        vi.mocked(fileSystem.readFile).mockResolvedValue('existing content');

        const manifest = createTestManifest();

        const result = await strategy.inject(manifest, {
          ...options,
          backup: false,
        });

        expect(fileSystem.backup).not.toHaveBeenCalled();
        expect(result.backupCreated).toBe(false);
      });

      it('should not create backup when file does not exist', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(false);

        const manifest = createTestManifest();

        const result = await strategy.inject(manifest, {
          ...options,
          backup: true,
        });

        expect(fileSystem.backup).not.toHaveBeenCalled();
        expect(result.backupCreated).toBe(false);
      });

      it('should throw BTWError when backup fails', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        vi.mocked(fileSystem.readFile).mockResolvedValue('existing content');
        vi.mocked(fileSystem.backup).mockRejectedValue(new Error('Backup failed'));

        const manifest = createTestManifest();

        await expect(
          strategy.inject(manifest, { ...options, backup: true })
        ).rejects.toMatchObject({
          code: ErrorCode.BACKUP_FAILED,
        });
      });
    });

    describe('BTW marker detection', () => {
      it('should detect existing BTW marker and reject different workflow without force', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        const existingContent = createMockBtwContent('different-workflow');
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        const manifest = createTestManifest({ id: 'new-workflow' });

        await expect(
          strategy.inject(manifest, options)
        ).rejects.toMatchObject({
          code: ErrorCode.INJECTION_FAILED,
        });
      });

      it('should allow injection with force option even when different workflow exists', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        const existingContent = createMockBtwContent('different-workflow');
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        const manifest = createTestManifest({ id: 'new-workflow' });

        const result = await strategy.inject(manifest, {
          ...options,
          force: true,
        });

        expect(result.target).toBe('claude');
        expect(fileSystem.writeFile).toHaveBeenCalled();
      });

      it('should allow injection when same workflow already exists', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        const existingContent = createMockBtwContent('test-workflow');
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        const manifest = createTestManifest({ id: 'test-workflow' });

        const result = await strategy.inject(manifest, options);

        expect(result.target).toBe('claude');
      });
    });

    describe('merge mode', () => {
      it('should merge with existing content when merge option is true', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        const existingContent = '# My Custom Instructions\n\nFollow these rules.';
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        const manifest = createTestManifest();

        await strategy.inject(manifest, {
          ...options,
          merge: true,
        });

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toContain('# My Custom Instructions');
        expect(writtenContent).toContain(BTW_START_MARKER);
        expect(writtenContent).toContain('---'); // separator
      });

      it('should remove existing BTW content before merging', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        const existingContent = `# My Custom Instructions

${BTW_START_MARKER}
${createBtwMarker('old-workflow')}
Old BTW content
${BTW_END_MARKER}`;
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        const manifest = createTestManifest();

        await strategy.inject(manifest, {
          ...options,
          merge: true,
          force: true,
        });

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        // Should contain user content but not old BTW content
        expect(writtenContent).toContain('# My Custom Instructions');
        expect(writtenContent).not.toContain('Old BTW content');
        expect(writtenContent).toContain(BTW_START_MARKER);
      });

      it('should overwrite when merge option is false', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        vi.mocked(fileSystem.readFile).mockResolvedValue('Existing content');

        const manifest = createTestManifest();

        await strategy.inject(manifest, {
          ...options,
          merge: false,
          force: true,
        });

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).not.toContain('Existing content');
        expect(writtenContent).toContain(BTW_START_MARKER);
      });
    });

    describe('generated content', () => {
      it('should include BTW markers', async () => {
        const manifest = createTestManifest();

        await strategy.inject(manifest, options);

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toContain(BTW_START_MARKER);
        expect(writtenContent).toContain(BTW_END_MARKER);
      });

      it('should include workflow metadata', async () => {
        const manifest = createTestManifest();

        await strategy.inject(manifest, options);

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toContain('**Workflow ID:** test-workflow');
        expect(writtenContent).toContain('**Version:** 1.0');
        expect(writtenContent).toContain('**Author:** Test Author');
        expect(writtenContent).toContain('**Repository:** https://github.com/test/workflow');
      });

      it('should include agent information', async () => {
        const manifest = createTestManifest();

        await strategy.inject(manifest, options);

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toContain('### Test Agent');
        expect(writtenContent).toContain('> A test agent for testing');
        expect(writtenContent).toContain('**Tags:** test, demo');
        expect(writtenContent).toContain('You are a test agent.');
      });

      it('should include BTW marker with workflow ID and timestamp', async () => {
        const manifest = createTestManifest();

        await strategy.inject(manifest, options);

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toMatch(/<!-- BTW:test-workflow:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z -->/);
      });
    });

    describe('error handling', () => {
      it('should throw BTWError on write failure', async () => {
        vi.mocked(fileSystem.writeFile).mockRejectedValue(new Error('Write failed'));

        const manifest = createTestManifest();

        await expect(
          strategy.inject(manifest, options)
        ).rejects.toMatchObject({
          code: ErrorCode.INJECTION_FAILED,
        });
      });

      it('should propagate existing BTWError', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        const existingContent = createMockBtwContent('different-workflow');
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        const manifest = createTestManifest({ id: 'new-workflow' });

        try {
          await strategy.inject(manifest, options);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BTWError);
          expect((error as BTWError).code).toBe(ErrorCode.INJECTION_FAILED);
        }
      });
    });
  });

  describe('eject()', () => {
    const options: EjectOptions = { projectRoot };

    describe('when instructions file does not exist', () => {
      it('should return without error', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(false);

        await expect(strategy.eject(options)).resolves.toBeUndefined();
        expect(fileSystem.remove).not.toHaveBeenCalled();
      });
    });

    describe('restore from backup', () => {
      it('should restore from backup when restoreBackup is true and backup exists', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(true); // backup exists

        await strategy.eject({
          ...options,
          restoreBackup: true,
        });

        expect(fileSystem.restore).toHaveBeenCalledWith(backupPath, instructionsPath);
        expect(fileSystem.remove).toHaveBeenCalledWith(backupPath);
      });

      it('should throw BTWError when restore fails', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(true); // backup exists
        vi.mocked(fileSystem.restore).mockRejectedValue(new Error('Restore failed'));

        await expect(
          strategy.eject({ ...options, restoreBackup: true })
        ).rejects.toMatchObject({
          code: ErrorCode.RESTORE_FAILED,
        });
      });
    });

    describe('clean option', () => {
      it('should remove entire .claude directory when clean is true', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValueOnce(true); // instructions exist

        await strategy.eject({
          ...options,
          clean: true,
        });

        expect(fileSystem.remove).toHaveBeenCalledWith(claudeDir, true);
      });

      it('should ignore FILE_NOT_FOUND error when cleaning', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValueOnce(true);
        vi.mocked(fileSystem.remove).mockRejectedValue(
          new BTWError(ErrorCode.FILE_NOT_FOUND, 'Not found')
        );

        await expect(
          strategy.eject({ ...options, clean: true })
        ).resolves.toBeUndefined();
      });
    });

    describe('removing BTW content only', () => {
      it('should remove only BTW content and preserve user content', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(false); // no backup

        const existingContent = `# My Custom Instructions

Follow these rules carefully.

${BTW_START_MARKER}
${createBtwMarker('test-workflow')}
BTW injected content here
${BTW_END_MARKER}`;
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        await strategy.eject(options);

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toContain('# My Custom Instructions');
        expect(writtenContent).toContain('Follow these rules carefully.');
        expect(writtenContent).not.toContain(BTW_START_MARKER);
        expect(writtenContent).not.toContain('BTW injected content');
      });

      it('should remove file if only BTW content existed', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(false); // no backup

        const existingContent = createMockBtwContent();
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        await strategy.eject(options);

        expect(fileSystem.remove).toHaveBeenCalledWith(instructionsPath);
      });

      it('should handle content with only BTW marker comment (fallback regex)', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(false); // no backup

        // Content with just a BTW marker (no BTW_START/END markers)
        const existingContent = `# User Content

${createBtwMarker('test-workflow')}
Some old format BTW content`;
        vi.mocked(fileSystem.readFile).mockResolvedValue(existingContent);

        await strategy.eject(options);

        const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
        const writtenContent = writeCall?.[1] as string;

        expect(writtenContent).toContain('# User Content');
        expect(writtenContent).not.toContain('BTW:test-workflow');
      });
    });

    describe('error handling', () => {
      it('should throw BTWError on unexpected error', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        vi.mocked(fileSystem.readFile).mockRejectedValue(new Error('Read failed'));

        await expect(strategy.eject(options)).rejects.toMatchObject({
          code: ErrorCode.INJECTION_FAILED,
        });
      });
    });
  });

  describe('getStatus()', () => {
    describe('when instructions file does not exist', () => {
      it('should return not injected status', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(false) // instructions don't exist
          .mockResolvedValueOnce(false); // no backup

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(false);
        expect(status.workflowId).toBeUndefined();
        expect(status.hasBackup).toBe(false);
      });

      it('should detect backup even when not injected', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(false) // instructions don't exist
          .mockResolvedValueOnce(true) // backup exists
          .mockResolvedValueOnce(true); // backup exists (second check)

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(false);
        expect(status.hasBackup).toBe(true);
        expect(status.backupPath).toBe(backupPath);
      });
    });

    describe('when instructions file exists', () => {
      it('should return injected status with workflow info when BTW marker found', async () => {
        const timestamp = '2024-01-15T10:30:00.000Z';
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(false); // no backup
        vi.mocked(fileSystem.readFile).mockResolvedValue(
          `${BTW_START_MARKER}\n${createBtwMarker('my-workflow', timestamp)}\nContent\n${BTW_END_MARKER}`
        );

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(true);
        expect(status.workflowId).toBe('my-workflow');
        expect(status.injectedAt).toBe(timestamp);
        expect(status.hasBackup).toBe(false);
      });

      it('should return not injected when no BTW marker found', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(false); // no backup
        vi.mocked(fileSystem.readFile).mockResolvedValue('# User instructions only');

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(false);
        expect(status.workflowId).toBeUndefined();
      });

      it('should include backup information', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true) // instructions exist
          .mockResolvedValueOnce(true); // backup exists
        vi.mocked(fileSystem.readFile).mockResolvedValue(createMockBtwContent());

        const status = await strategy.getStatus(projectRoot);

        expect(status.hasBackup).toBe(true);
        expect(status.backupPath).toBe(backupPath);
      });
    });

    describe('error handling', () => {
      it('should return not injected status on read error', async () => {
        vi.mocked(fileSystem.exists).mockResolvedValue(true);
        vi.mocked(fileSystem.readFile).mockRejectedValue(new Error('Read failed'));

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(false);
        expect(status.hasBackup).toBe(false);
      });
    });
  });

  describe('validate()', () => {
    it('should return true when no files exist', async () => {
      vi.mocked(fileSystem.exists).mockResolvedValue(false);

      const isValid = await strategy.validate(projectRoot);

      expect(isValid).toBe(true);
    });

    it('should return true when instructions file is valid', async () => {
      vi.mocked(fileSystem.exists)
        .mockResolvedValueOnce(true) // instructions exist
        .mockResolvedValueOnce(false); // settings don't exist
      vi.mocked(fileSystem.readFile).mockResolvedValue('# Valid markdown content');

      const isValid = await strategy.validate(projectRoot);

      expect(isValid).toBe(true);
    });

    it('should return true when settings file contains valid JSON', async () => {
      vi.mocked(fileSystem.exists)
        .mockResolvedValueOnce(false) // instructions don't exist
        .mockResolvedValueOnce(true); // settings exist
      vi.mocked(fileSystem.readFile).mockResolvedValue('{"model": "claude-3-opus"}');

      const isValid = await strategy.validate(projectRoot);

      expect(isValid).toBe(true);
    });

    it('should return false when settings file contains invalid JSON', async () => {
      vi.mocked(fileSystem.exists)
        .mockResolvedValueOnce(false) // instructions don't exist
        .mockResolvedValueOnce(true); // settings exist
      vi.mocked(fileSystem.readFile).mockResolvedValue('{ invalid json }');

      const isValid = await strategy.validate(projectRoot);

      expect(isValid).toBe(false);
    });

    it('should return false on read error', async () => {
      vi.mocked(fileSystem.exists).mockResolvedValue(true);
      vi.mocked(fileSystem.readFile).mockRejectedValue(new Error('Read failed'));

      const isValid = await strategy.validate(projectRoot);

      expect(isValid).toBe(false);
    });
  });

  describe('generateConfig()', () => {
    it('should generate valid JSON config', () => {
      const manifest = createTestManifest();

      const config = strategy.generateConfig(manifest);
      const parsed = JSON.parse(config);

      expect(parsed._btw).toBeDefined();
      expect(parsed._btw.workflowId).toBe('test-workflow');
      expect(parsed._btw.version).toBe('1.0.0');
    });

    it('should include model from first agent if specified', () => {
      const manifest = createTestManifest({
        agents: [
          {
            id: 'agent',
            name: 'Agent',
            description: 'Desc',
            systemPrompt: 'Prompt',
            model: 'claude-3-opus-20240229',
          },
        ],
      });

      const config = strategy.generateConfig(manifest);
      const parsed = JSON.parse(config);

      expect(parsed.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('generateInstructions()', () => {
    it('should generate markdown with BTW markers', () => {
      const manifest = createTestManifest();

      const instructions = strategy.generateInstructions(manifest);

      expect(instructions).toContain(BTW_START_MARKER);
      expect(instructions).toContain(BTW_END_MARKER);
    });

    it('should include workflow name as header', () => {
      const manifest = createTestManifest({ name: 'My Workflow' });

      const instructions = strategy.generateInstructions(manifest);

      expect(instructions).toContain('# My Workflow');
    });

    it('should include workflow description', () => {
      const manifest = createTestManifest({
        description: 'This is a detailed description.',
      });

      const instructions = strategy.generateInstructions(manifest);

      expect(instructions).toContain('This is a detailed description.');
    });

    it('should include agent sections', () => {
      const manifest = createTestManifest({
        agents: [
          {
            id: 'agent1',
            name: 'First Agent',
            description: 'First agent description',
            systemPrompt: 'First agent prompt',
            tags: ['first', 'test'],
          },
          {
            id: 'agent2',
            name: 'Second Agent',
            description: 'Second agent description',
            systemPrompt: 'Second agent prompt',
          },
        ],
      });

      const instructions = strategy.generateInstructions(manifest);

      expect(instructions).toContain('### First Agent');
      expect(instructions).toContain('> First agent description');
      expect(instructions).toContain('**Tags:** first, test');
      expect(instructions).toContain('First agent prompt');
      expect(instructions).toContain('### Second Agent');
      expect(instructions).toContain('Second agent prompt');
      expect(instructions).toContain('---'); // separator between agents
    });

    it('should include injection footer with timestamp', () => {
      const manifest = createTestManifest();

      const instructions = strategy.generateInstructions(manifest);

      expect(instructions).toMatch(/\*Injected by BTW v\d+\.\d+\.\d+ at \d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('BaseInjectionStrategy marker methods', () => {
    describe('createMarker()', () => {
      it('should be included in generated instructions', () => {
        const manifest = createTestManifest({ id: 'marker-test-workflow' });

        const instructions = strategy.generateInstructions(manifest);

        expect(instructions).toMatch(/<!-- BTW:marker-test-workflow:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z -->/);
      });
    });

    describe('extractMarker()', () => {
      it('should extract marker from getStatus', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        vi.mocked(fileSystem.readFile).mockResolvedValue(
          `Content\n${createBtwMarker('extracted-workflow', '2024-06-15T12:00:00.000Z')}\nMore content`
        );

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(true);
        expect(status.workflowId).toBe('extracted-workflow');
        expect(status.injectedAt).toBe('2024-06-15T12:00:00.000Z');
      });

      it('should return null for content without marker', async () => {
        vi.mocked(fileSystem.exists)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        vi.mocked(fileSystem.readFile).mockResolvedValue('No marker here');

        const status = await strategy.getStatus(projectRoot);

        expect(status.isInjected).toBe(false);
        expect(status.workflowId).toBeUndefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle manifest without optional fields', async () => {
      const minimalManifest: Manifest = {
        version: '1.0',
        id: 'minimal',
        name: 'Minimal',
        description: 'Minimal workflow',
        targets: ['claude'],
        agents: [
          {
            id: 'agent',
            name: 'Agent',
            description: 'Desc',
            systemPrompt: 'Prompt',
          },
        ],
      };

      const result = await strategy.inject(minimalManifest, { projectRoot });

      expect(result.target).toBe('claude');
    });

    it('should handle empty agents array', async () => {
      const manifest = createTestManifest({ agents: [] });

      const result = await strategy.inject(manifest, { projectRoot });

      expect(result.agentCount).toBe(0);
    });

    it('should handle agent without tags', async () => {
      const manifest = createTestManifest({
        agents: [
          {
            id: 'agent',
            name: 'No Tags Agent',
            description: 'Agent without tags',
            systemPrompt: 'Prompt',
          },
        ],
      });

      const instructions = strategy.generateInstructions(manifest);

      expect(instructions).not.toContain('**Tags:**');
    });

    it('should handle special characters in content', async () => {
      const manifest = createTestManifest({
        description: 'Contains <special> & "characters"',
        agents: [
          {
            id: 'agent',
            name: 'Agent with `code`',
            description: 'Description with *markdown*',
            systemPrompt: 'Prompt with {{templates}} and $variables',
          },
        ],
      });

      const result = await strategy.inject(manifest, { projectRoot });

      expect(result.target).toBe('claude');

      const writeCall = vi.mocked(fileSystem.writeFile).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;

      expect(writtenContent).toContain('<special>');
      expect(writtenContent).toContain('*markdown*');
      expect(writtenContent).toContain('{{templates}}');
    });
  });
});
