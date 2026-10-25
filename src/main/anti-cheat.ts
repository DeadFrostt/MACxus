import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

/** Clear inherited per-launch markers; the package's own launcher controls EAC. */
export function antiCheatEnvironment(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const result = { ...environment };
  // These are launch-scoped values, not global launcher preferences.
  delete result.EOS_USE_ANTICHEATCLIENTNULL;
  delete result.PROTON_EAC_LAUNCHER_PROCESS;
  // Keep PROTON_EAC_RUNTIME: it selects the actual compatibility bridge.
  return result;
}

/**
 * Per-game opt-in for offline play: start the EAC target directly with the EOS
 * Null Client. EOS reports no anti-cheat, so protected online features stay
 * unavailable. Returns false when the game declares no EAC target.
 */
export function offlineAntiCheatLaunch(args: string[], environment: NodeJS.ProcessEnv, target: string | undefined): boolean {
  const exe = args.indexOf('--exe');
  if (!target?.trim() || exe < 0 || exe + 1 >= args.length) return false;
  args[exe + 1] = target;
  environment.EOS_USE_ANTICHEATCLIENTNULL = '1';
  return true;
}

/** Discover an already installed official Steam tool; never download or copy it. */
export async function installedEacRuntime(steamRoot: string): Promise<string | undefined> {
  const libraries = new Set([steamRoot]);
  try {
    const folders = await fs.readFile(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const match of folders.matchAll(/"path"\s*"((?:\\.|[^"\\])*)"/g)) {
      const folder = match[1].replace(/\\([\\"])/g, '$1');
      if (path.isAbsolute(folder)) libraries.add(folder);
    }
  } catch { /* Steam or a library listing need not exist. */ }
  for (const library of libraries) {
    const root = path.join(library, 'steamapps', 'common', 'Proton EasyAntiCheat Runtime');
    try {
      for (const name of ['easyanticheat_x64.dll', 'easyanticheat_x64.so']) {
        const file = path.join(root, 'v2', 'lib64', name);
        await fs.access(file, constants.R_OK);
        if (!(await fs.stat(file)).isFile()) throw new Error('Not an EAC bridge file.');
      }
      return root;
    } catch { /* Incomplete installs must not be advertised as a runtime. */ }
  }
  return undefined;
}
