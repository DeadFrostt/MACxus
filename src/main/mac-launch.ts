import path from 'node:path';

export const CROSSOVER_MISSING = 'CrossOver non trovato. Installa CrossOver in Applicazioni e riprova.';

/** Folder of the runtime's Windows DLLs; the root is resolved from files/bin/wine as in proton.ts. */
export function runtimeDllDirectory(winePath: string): string {
  const root = path.resolve(path.dirname(winePath), '..', '..');
  return path.join(root, 'files', 'lib', 'wine', 'x86_64-windows');
}

/** macOS limits AF_UNIX paths to 104 bytes including the terminating NUL. */
export function serviceSocketPathFits(socketPath: string): boolean {
  return Buffer.byteLength(socketPath) < 104;
}
