import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@ido4/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ido4/core')>();
  return {
    ...actual,
    ServiceContainer: {
      create: mockCreate,
    },
    ConsoleLogger: vi.fn().mockImplementation(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      audit: vi.fn(),
      performance: vi.fn(),
      child: vi.fn(),
    })),
  };
});

import { getContainer, resetContainer } from '../../src/helpers/container-init.js';

const mockContainer = { taskService: {}, waveService: {} };

describe('container-init', () => {
  beforeEach(() => {
    resetContainer();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  it('creates container on first call', async () => {
    const container = await getContainer();
    expect(container).toBe(mockContainer);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('returns same container on subsequent calls', async () => {
    const first = await getContainer();
    const second = await getContainer();
    expect(first).toBe(second);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('shares promise across concurrent calls', async () => {
    const [a, b, c] = await Promise.all([
      getContainer(),
      getContainer(),
      getContainer(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('creates fresh container after reset', async () => {
    await getContainer();
    resetContainer();
    await getContainer();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('passes GITHUB_TOKEN from env', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'ghp_test123';
    resetContainer();

    await getContainer();

    const createCall = mockCreate.mock.calls[0]![0];
    expect(createCall.githubToken).toBe('ghp_test123');

    if (originalToken !== undefined) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  it('uses IDO4_PROJECT_ROOT env var when set', async () => {
    const originalRoot = process.env.IDO4_PROJECT_ROOT;
    process.env.IDO4_PROJECT_ROOT = '/custom/project';
    resetContainer();

    await getContainer();

    const createCall = mockCreate.mock.calls[0]![0];
    expect(createCall.projectRoot).toBe('/custom/project');

    if (originalRoot !== undefined) {
      process.env.IDO4_PROJECT_ROOT = originalRoot;
    } else {
      delete process.env.IDO4_PROJECT_ROOT;
    }
  });
});
