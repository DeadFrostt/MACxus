import { mkdtemp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAC_RUNTIME_DLLS, crossOverWrapperScript, findCrossOver, prepareCrossOverRunner, stripBuiltinMarker, type CrossOverInstall } from './crossover.js';

const temporary: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nexus-cx-'));
  temporary.push(dir);
  return dir;
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

const MARKER = Buffer.from('Wine builtin DLL');
function dll(marked: boolean): Buffer {
  const bytes = Buffer.alloc(128, 0x41);
  if (marked) MARKER.copy(bytes, 64);
  return bytes;
}

async function fakeInstall(base: string, log: string): Promise<CrossOverInstall> {
  const root = path.join(base, 'CrossOver.app/Contents/SharedSupport/CrossOver');
  await mkdir(path.join(root, 'bin'), { recursive: true });
  const script = (body: string) => `#!/bin/sh\n${body}\n`;
  await writeFile(path.join(root, 'bin/cxbottle'), script(`echo "cxbottle $*" >> '${log}'\nb="$CX_BOTTLE_PATH/xbox"\nmkdir -p "$b/drive_c/windows/system32"\n: > "$b/system.reg"`), { mode: 0o755 });
  await writeFile(path.join(root, 'bin/wine'), script(`echo "wine $*" >> '${log}'`), { mode: 0o755 });
  await writeFile(path.join(root, 'bin/wineserver'), script(`echo "wineserver $*" >> '${log}'`), { mode: 0o755 });
  return { root, wine: path.join(root, 'bin/wine'), wineserver: path.join(root, 'bin/wineserver'), cxbottle: path.join(root, 'bin/cxbottle'), version: '26.3' };
}

describe('stripBuiltinMarker', () => {
  it('zeroes only bytes 64..80 when the marker is present', () => {
    const input = dll(true);
    const out = stripBuiltinMarker(input);
    expect(out).not.toBe(input);
    expect(out.subarray(64, 80).equals(Buffer.alloc(16))).toBe(true);
    expect(out.subarray(0, 64).equals(input.subarray(0, 64))).toBe(true);
    expect(out.subarray(80).equals(input.subarray(80))).toBe(true);
    expect(input.subarray(64, 80).equals(MARKER)).toBe(true);
  });
  it('leaves an unmarked buffer identical', () => {
    const input = dll(false);
    expect(stripBuiltinMarker(input).equals(input)).toBe(true);
  });
});

describe('crossOverWrapperScript', () => {
  it('exports the bottle environment and handles launch, wait and stop', () => {
    const cx = { root: '/cx', wine: '/cx/bin/wine', wineserver: '/cx/bin/wineserver', cxbottle: '/cx/bin/cxbottle', version: '26.3' };
    const script = crossOverWrapperScript(cx, '/b', 'xbox', 'd3dmetal');
    expect(script).toContain("export CX_BOTTLE_PATH='/b'");
    expect(script).toContain('CX_GRAPHICS_BACKEND');
    expect(script).toContain('--nexus-stop-prefix');
    expect(script).toContain('-k');
    expect(script).toContain('-w');
    expect(script).toContain("'/cx/bin/wine' --bottle 'xbox' \"$@\"");
  });
});

describe('findCrossOver', () => {
  it('returns undefined when nothing is installed', async () => {
    expect(await findCrossOver([await tmp()])).toBeUndefined();
  });
  it('finds a root with executables and reads the version', async () => {
    const base = await tmp();
    const cx = await fakeInstall(base, path.join(base, 'log'));
    await writeFile(path.join(base, 'CrossOver.app/Contents/Info.plist'), '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>26.3</string></dict></plist>');
    const found = await findCrossOver([path.join(base, 'missing'), cx.root]);
    expect(found).toEqual(cx);
  });
});

describe('prepareCrossOverRunner', () => {
  it('creates the bottle once, installs stripped DLLs and sets overrides', async () => {
    const base = await tmp();
    const log = path.join(base, 'log');
    const cx = await fakeInstall(base, log);
    const bottles = path.join(base, 'bottles');
    const runtime = path.join(base, 'runtime');
    await mkdir(runtime);
    for (const name of MAC_RUNTIME_DLLS) await writeFile(path.join(runtime, name), dll(true));

    const first = await prepareCrossOverRunner(cx, bottles, runtime);
    const second = await prepareCrossOverRunner(cx, bottles, runtime);

    const calls = (await readFile(log, 'utf8')).split('\n').filter(Boolean);
    expect(calls.filter((line) => line.startsWith('cxbottle') && line.includes('--create'))).toHaveLength(1);
    expect(calls.filter((line) => line.includes('reg add'))).toHaveLength(MAC_RUNTIME_DLLS.length);
    expect(calls.find((line) => line.includes('xgameruntime'))).toContain('native,builtin');
    for (const name of MAC_RUNTIME_DLLS) {
      const copied = await readFile(path.join(bottles, 'xbox/drive_c/windows/system32', name));
      expect(copied.subarray(64, 80).equals(Buffer.alloc(16))).toBe(true);
    }
    expect(first).toEqual(second);
    expect(first.command).toBe(path.join(bottles, 'xodus-crossover-wine'));
    expect(first.compatibilityDataPath).toBe(path.join(bottles, 'xbox'));
    expect(first.stopPrefix).toEqual({ command: first.command, args: ['--nexus-stop-prefix'] });
    await chmod(first.command, 0o700);
    expect(await readFile(first.command, 'utf8')).toContain('CX_BOTTLE_PATH');
  });
});
