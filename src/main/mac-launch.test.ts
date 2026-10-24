import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CROSSOVER_MISSING, macRuntimeAvailable, runtimeDllDirectory, serviceSocketPathFits } from './mac-launch.js';

describe('runtimeDllDirectory', () => {
  it('points at the runtime x86_64-windows DLL folder next to files/bin/wine', () => {
    expect(runtimeDllDirectory('/r/releases/x/files/bin/wine')).toBe('/r/releases/x/files/lib/wine/x86_64-windows');
  });
});

describe('serviceSocketPathFits', () => {
  it('accepts the default macOS user-data socket path', () => {
    expect(serviceSocketPathFits('/Users/maurizio/Library/Application Support/MACxus/service-sessions/game-abc123/xodus.sock')).toBe(true);
  });

  it('rejects a path longer than the macOS sun_path limit', () => {
    expect(serviceSocketPathFits('/' + 'a'.repeat(119))).toBe(false);
  });
});

describe('CROSSOVER_MISSING', () => {
  it('tells the user to install CrossOver', () => {
    expect(CROSSOVER_MISSING).toBe('CrossOver non trovato. Installa CrossOver in Applicazioni e riprova.');
  });
});

describe('macRuntimeAvailable', () => {
  it('accepts a runtime with the patch metadata and the four Windows DLLs, and rejects a partial one', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nexus-macrt-'));
    try {
      const wine = path.join(root, 'files', 'bin', 'wine');
      const dlls = path.join(root, 'files', 'lib', 'wine', 'x86_64-windows');
      await mkdir(dlls, { recursive: true });
      expect(await macRuntimeAvailable(wine)).toBe(false);
      for (const name of ['xgameruntime.dll', 'windows.web.dll', 'twinapi.appcore.dll', 'gamingtcui.dll']) await writeFile(path.join(dlls, name), 'MZ');
      expect(await macRuntimeAvailable(wine)).toBe(false);
      await writeFile(path.join(root, 'XODUS_NEXUS_PATCH.json'), '{}');
      expect(await macRuntimeAvailable(wine)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
