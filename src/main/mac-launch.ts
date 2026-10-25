import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { MAC_RUNTIME_DLLS } from './crossover.js';
import { run, type RunOptions, type RunResult } from './process.js';

export const CROSSOVER_MISSING = 'CrossOver non trovato. Installa CrossOver in Applicazioni e riprova.';

/** Folder of the runtime's Windows DLLs; the root is resolved from files/bin/wine as in proton.ts. */
export function runtimeDllDirectory(winePath: string): string {
  const root = path.resolve(path.dirname(winePath), '..', '..');
  return path.join(root, 'files', 'lib', 'wine', 'x86_64-windows');
}

/**
 * On macOS the runtime's files/bin/wine is a Linux ELF that is never executed:
 * a runtime is usable when it carries its patch metadata and the Windows DLLs
 * copied into the CrossOver bottle. winePath stays the runtime locator.
 */
export async function macRuntimeAvailable(winePath: string): Promise<boolean> {
  const root = path.resolve(path.dirname(winePath), '..', '..');
  const dlls = runtimeDllDirectory(winePath);
  const required = [path.join(root, 'XODUS_NEXUS_PATCH.json'), ...MAC_RUNTIME_DLLS.map((name) => path.join(dlls, name))];
  try {
    await Promise.all(required.map((file) => fs.access(file, constants.R_OK)));
    return true;
  } catch { return false; }
}

/** macOS limits AF_UNIX paths to 104 bytes including the terminating NUL. */
export function serviceSocketPathFits(socketPath: string): boolean {
  return Buffer.byteLength(socketPath) < 104;
}

const WINEBUS_KEY = 'HKLM\\System\\CurrentControlSet\\Services\\winebus';

/** Whether a prefix's system.reg sets winebus DisableHidraw to a non-zero value. Wine stores
 * CurrentControlSet, a registry link, under ControlSet001. */
export function prefixHidrawDisabled(systemReg: string): boolean {
  const section = systemReg.split(/\r?\n(?=\[)/).find(block => /^\[System\\\\(?:CurrentControlSet|ControlSet\d{3})\\\\Services\\\\winebus\]/i.test(block));
  const value = section?.match(/^"DisableHidraw"=dword:([0-9a-f]{8})$/im)?.[1];
  return value !== undefined && parseInt(value, 16) !== 0;
}

/**
 * DualSense compatibility mode on macOS. Wine exposes a DualSense as a raw HID
 * device by default, which XInput titles do not see; PROTON_DISABLE_HIDRAW
 * exists only in Proton, so the macOS engines need winebus DisableHidraw in
 * the prefix registry. SDL then maps the controller as an XInput gamepad.
 * The bottle is shared by all games, so the value follows the launched game.
 */
export async function syncMacDualSenseCompatibility(
  wineCommand: string,
  prefix: string,
  enabled: boolean,
  env: NodeJS.ProcessEnv,
  onLine: (line: string) => void,
  runCommand: (command: string, args: string[], options: RunOptions) => Promise<RunResult> = run,
): Promise<void> {
  let current = false;
  try { current = prefixHidrawDisabled(await fs.readFile(path.join(prefix, 'system.reg'), 'latin1')); } catch { /* new prefix */ }
  if (current === enabled) return;
  onLine(enabled
    ? 'DualSense compatibility mode: the controller is exposed to the game as an XInput gamepad.'
    : 'DualSense compatibility mode off: the controller is exposed to the game as a native DualSense HID device.');
  const result = await runCommand(wineCommand, ['reg', 'add', WINEBUS_KEY, '/v', 'DisableHidraw', '/t', 'REG_DWORD', '/d', enabled ? '1' : '0', '/f'], { env, maxOutput: 100_000 });
  if (result.code !== 0) onLine(`The DualSense compatibility setting could not be applied (reg exited with code ${result.code}).`);
}
