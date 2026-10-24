import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { MAC_RUNTIME_DLLS } from './crossover.js';

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
