import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareManagedPrefix } from './managed-prefix.js';

const roots: string[] = [];
async function fixture() {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'nexus-prefix-mode-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('managed prefix permissions', () => {
  it('creates private directories without changing the global umask', async () => {
    const root = await fixture(), compat = path.join(root, 'compatdata', 'game');
    const mask = process.umask();
    await prepareManagedPrefix(compat);
    for (const directory of [compat, path.join(compat, 'pfx')]) expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
    expect(process.umask()).toBe(mask);
  });

  it.each([0o775, 0o755, 0o700])('repairs only the owned directory boundaries (%s), preserving all prefix contents', async mode => {
    const root = await fixture(), compat = path.join(root, 'game'), prefix = path.join(compat, 'pfx');
    const nested = path.join(prefix, 'drive_c', 'users', 'test');
    await fs.mkdir(nested, { recursive: true });
    await fs.chmod(compat, mode); await fs.chmod(prefix, mode); await fs.chmod(nested, 0o755);
    const file = path.join(nested, 'unchanged.dat');
    await fs.writeFile(file, 'existing data', { mode: 0o644 });
    const before = await fs.stat(file);
    await prepareManagedPrefix(compat);
    await prepareManagedPrefix(compat);
    expect((await fs.stat(compat)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(prefix)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(nested)).mode & 0o777).toBe(0o755);
    expect(await fs.stat(file)).toEqual(before);
    expect(await fs.readFile(file, 'utf8')).toBe('existing data');
  });

  it.each(['game', 'game/pfx'])('refuses a symlink at %s without modifying its target', async leaf => {
    const root = await fixture(), target = path.join(root, 'external');
    await fs.mkdir(target, { mode: 0o755 }); await fs.chmod(target, 0o755);
    const link = path.join(root, leaf);
    await fs.mkdir(path.dirname(link), { recursive: true }); await fs.symlink(target, link);
    await expect(prepareManagedPrefix(path.join(root, 'game'))).rejects.toThrow();
    expect((await fs.stat(target)).mode & 0o777).toBe(0o755);
    expect(await fs.readdir(target)).toEqual([]);
  });

  it('refuses a different owner before chmod or prefix creation', async () => {
    const root = await fixture(), compat = path.join(root, 'game');
    await fs.mkdir(compat); await fs.chmod(compat, 0o775);
    vi.spyOn(process, 'geteuid').mockReturnValue(process.geteuid!() + 1);
    await expect(prepareManagedPrefix(compat)).rejects.toThrow('owned by the current user');
    expect((await fs.stat(compat)).mode & 0o777).toBe(0o775);
    expect(await fs.readdir(compat)).toEqual([]);
  });

  it('refuses files and relative paths', async () => {
    const root = await fixture();
    await fs.writeFile(path.join(root, 'file'), 'unchanged');
    await expect(prepareManagedPrefix(path.join(root, 'file'))).rejects.toThrow();
    await expect(prepareManagedPrefix('relative')).rejects.toThrow('absolute');
    expect(await fs.readFile(path.join(root, 'file'), 'utf8')).toBe('unchanged');
  });
});
