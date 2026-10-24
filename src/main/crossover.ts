import { constants, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './process.js';
import type { ProtonRunner } from './proton.js';

export const MAC_RUNTIME_DLLS = ['xgameruntime.dll', 'windows.web.dll', 'twinapi.appcore.dll', 'gamingtcui.dll'] as const;

export interface CrossOverInstall {
  root: string;
  wine: string;
  wineserver: string;
  cxbottle: string;
  version: string;
}

type Graphics = 'd3dmetal' | 'dxmt' | 'wined3d';

const BOTTLE = 'xbox';
const BUILTIN_MARKER = Buffer.from('Wine builtin DLL');

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export async function findCrossOver(candidates?: string[]): Promise<CrossOverInstall | undefined> {
  const roots = candidates ?? [
    '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver',
    path.join(os.homedir(), 'Applications/CrossOver.app/Contents/SharedSupport/CrossOver'),
  ];
  for (const root of roots) {
    const wine = path.join(root, 'bin', 'wine');
    const wineserver = path.join(root, 'bin', 'wineserver');
    const cxbottle = path.join(root, 'bin', 'cxbottle');
    try {
      await Promise.all([wine, wineserver, cxbottle].map((file) => fs.access(file, constants.X_OK)));
    } catch { continue; }
    let version = '';
    try {
      const plist = path.join(root, '..', '..', 'Info.plist');
      const result = await run('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', plist]);
      if (result.code === 0) version = result.output.trim();
    } catch { /* version stays unknown */ }
    return { root, wine, wineserver, cxbottle, version };
  }
  return undefined;
}

/** Wine treats a builtin-marked file in system32 as a placeholder; clearing the marker makes it load as native. */
export function stripBuiltinMarker(bytes: Buffer): Buffer {
  const copy = Buffer.from(bytes);
  if (copy.length >= 80 && copy.subarray(64, 80).equals(BUILTIN_MARKER)) copy.fill(0, 64, 80);
  return copy;
}

export function crossOverWrapperScript(cx: CrossOverInstall, bottlesRoot: string, bottle: string, graphics: Graphics): string {
  const prefix = path.join(bottlesRoot, bottle);
  return [
    '#!/bin/sh',
    `export CX_BOTTLE_PATH=${shellQuote(bottlesRoot)}`,
    `export CX_GRAPHICS_BACKEND="\${CX_GRAPHICS_BACKEND:-${graphics}}"`,
    `export WINEPREFIX=${shellQuote(prefix)}`,
    'if [ "${1:-}" = "--nexus-stop-prefix" ]; then',
    `  exec ${shellQuote(cx.wineserver)} -k`,
    'fi',
    'launch_status=0',
    `${shellQuote(cx.wine)} --bottle ${shellQuote(bottle)} "$@" || launch_status=$?`,
    'wait_status=0',
    `${shellQuote(cx.wineserver)} -w || wait_status=$?`,
    'if [ "$launch_status" -ne 0 ]; then exit "$launch_status"; fi',
    'exit "$wait_status"',
    '',
  ].join('\n');
}

export async function prepareCrossOverRunner(
  cx: CrossOverInstall,
  bottlesRoot: string,
  runtimeDllDir: string,
  graphics: Graphics = 'd3dmetal',
): Promise<ProtonRunner> {
  const bottlePath = path.join(bottlesRoot, BOTTLE);
  const env = { ...process.env, CX_BOTTLE_PATH: bottlesRoot };
  await fs.mkdir(bottlesRoot, { recursive: true });

  let existed = true;
  try { await fs.access(path.join(bottlePath, 'system.reg')); } catch { existed = false; }
  if (!existed) {
    const created = await run(cx.cxbottle, ['--bottle', BOTTLE, '--create', '--template', 'win10_64'], { env });
    try { await fs.access(path.join(bottlePath, 'system.reg')); } catch {
      throw new Error(`The CrossOver bottle was not created: ${created.output.trim().split('\n').slice(-3).join(' | ') || `code ${created.code}`}`);
    }
  }

  const system32 = path.join(bottlePath, 'drive_c', 'windows', 'system32');
  await fs.mkdir(system32, { recursive: true });
  const changed: string[] = [];
  for (const name of MAC_RUNTIME_DLLS) {
    const stripped = stripBuiltinMarker(await fs.readFile(path.join(runtimeDllDir, name)));
    const target = path.join(system32, name);
    let current: Buffer | undefined;
    try { current = await fs.readFile(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (current?.equals(stripped)) continue;
    const temporary = `${target}.nexus-${process.pid}`;
    try {
      await fs.writeFile(temporary, stripped, { mode: 0o644 });
      await fs.rename(temporary, target);
    } finally { await fs.unlink(temporary).catch(() => undefined); }
    changed.push(name);
  }

  if (!existed || changed.length > 0) {
    for (const name of MAC_RUNTIME_DLLS) {
      const result = await run(cx.wine, ['--bottle', BOTTLE, 'reg', 'add', 'HKCU\\Software\\Wine\\DllOverrides', '/v', name.replace(/\.dll$/i, ''), '/t', 'REG_SZ', '/d', 'native,builtin', '/f'], { env });
      if (result.code !== 0) throw new Error(`Could not set the ${name} override in the CrossOver bottle (code ${result.code})`);
    }
  }

  const runner = path.join(bottlesRoot, 'xodus-crossover-wine');
  const temporary = `${runner}.tmp-${process.pid}`;
  await fs.writeFile(temporary, crossOverWrapperScript(cx, bottlesRoot, BOTTLE, graphics), { mode: 0o700 });
  await fs.rename(temporary, runner);
  await fs.chmod(runner, 0o700);
  return { command: runner, compatibilityDataPath: bottlePath, stopPrefix: { command: runner, args: ['--nexus-stop-prefix'] } };
}
