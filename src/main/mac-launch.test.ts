import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAC_RUNTIME_DLLS } from './crossover.js';
import { CROSSOVER_MISSING, macRuntimeAvailable, prefixHidrawDisabled, runtimeDllDirectory, serviceSocketPathFits, syncMacDualSenseCompatibility } from './mac-launch.js';

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
  it('accepts a runtime with the patch metadata and the Windows DLLs, and rejects a partial one', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nexus-macrt-'));
    try {
      const wine = path.join(root, 'files', 'bin', 'wine');
      const dlls = path.join(root, 'files', 'lib', 'wine', 'x86_64-windows');
      await mkdir(dlls, { recursive: true });
      expect(await macRuntimeAvailable(wine)).toBe(false);
      for (const name of MAC_RUNTIME_DLLS) await writeFile(path.join(dlls, name), 'MZ');
      expect(await macRuntimeAvailable(wine)).toBe(false);
      await writeFile(path.join(root, 'XODUS_NEXUS_PATCH.json'), '{}');
      expect(await macRuntimeAvailable(wine)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

const winebusReg = (value?: string) => `WINE REGISTRY Version 2\n\n[System\\\\CurrentControlSet\\\\Services\\\\winebus] 1761400000\n#time=1dc45\n${value === undefined ? '' : `"DisableHidraw"=dword:${value}\n`}"Start"=dword:00000003\n\n[System\\\\CurrentControlSet\\\\Services\\\\other]\n"DisableHidraw"=dword:00000001\n`;

describe('prefixHidrawDisabled', () => {
  it('reads DisableHidraw only from the winebus service key', () => {
    expect(prefixHidrawDisabled(winebusReg('00000001'))).toBe(true);
    expect(prefixHidrawDisabled(winebusReg('00000000'))).toBe(false);
    expect(prefixHidrawDisabled(winebusReg())).toBe(false);
    expect(prefixHidrawDisabled('')).toBe(false);
    expect(prefixHidrawDisabled(winebusReg('00000001').replace('CurrentControlSet', 'ControlSet001'))).toBe(true);
  });
});

describe('syncMacDualSenseCompatibility', () => {
  const withPrefix = async (systemReg: string | undefined, test: (prefix: string) => Promise<void>) => {
    const prefix = await mkdtemp(path.join(os.tmpdir(), 'nexus-hidraw-'));
    try {
      if (systemReg !== undefined) await writeFile(path.join(prefix, 'system.reg'), systemReg, 'latin1');
      await test(prefix);
    } finally {
      await rm(prefix, { recursive: true, force: true });
    }
  };

  it('writes DisableHidraw=1 when the mode is on, and back to 0 when it is off', async () => {
    for (const [enabled, current, expected] of [[true, '00000000', '1'], [false, '00000001', '0'], [true, undefined, '1']] as const) {
      await withPrefix(winebusReg(current), async prefix => {
        const calls: string[][] = [];
        const lines: string[] = [];
        await syncMacDualSenseCompatibility('/bottle/wine', prefix, enabled, {}, line => lines.push(line), async (_command, args) => { calls.push(args); return { code: 0, output: '' }; });
        expect(calls).toEqual([['reg', 'add', 'HKLM\\System\\CurrentControlSet\\Services\\winebus', '/v', 'DisableHidraw', '/t', 'REG_DWORD', '/d', expected, '/f']]);
        expect(lines.join('\n')).toContain('DualSense');
      });
    }
  });

  it('does not start wine when the prefix already matches the mode', async () => {
    for (const [enabled, current] of [[true, '00000001'], [false, '00000000'], [false, undefined]] as const) {
      await withPrefix(winebusReg(current), async prefix => {
        let called = false;
        await syncMacDualSenseCompatibility('/bottle/wine', prefix, enabled, {}, () => undefined, async () => { called = true; return { code: 0, output: '' }; });
        expect(called).toBe(false);
      });
    }
  });

  it('reports a failed reg write without throwing', async () => {
    await withPrefix(undefined, async prefix => {
      const lines: string[] = [];
      await syncMacDualSenseCompatibility('/bottle/wine', prefix, true, {}, line => lines.push(line), async () => ({ code: 5, output: '' }));
      expect(lines.at(-1)).toContain('5');
    });
  });
});
