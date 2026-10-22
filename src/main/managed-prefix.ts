import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

// Only directory permissions are repaired, never files inside an existing
// prefix. Do this before Proton starts: its Wine bootstrap uses the same guard
// as a normal launch. Do not change the process-wide umask in an async app.
async function privateDirectory(directory: string): Promise<void> {
  const handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isDirectory() || before.uid !== process.geteuid?.()) {
      throw new Error('The managed Proton prefix must be a directory owned by the current user.');
    }
    if ((before.mode & 0o777) !== 0o700) await handle.chmod(0o700);
    const current = await fs.lstat(directory);
    if (current.isSymbolicLink() || current.dev !== before.dev || current.ino !== before.ino || (current.mode & 0o777) !== 0o700) {
      throw new Error('The managed Proton prefix changed while checking its permissions.');
    }
  } finally { await handle.close(); }
}

export async function prepareManagedPrefix(compatibilityDataPath: string): Promise<void> {
  if (!path.isAbsolute(compatibilityDataPath)) throw new Error('The managed Proton prefix path must be absolute.');
  await fs.mkdir(compatibilityDataPath, { recursive: true, mode: 0o700 });
  await privateDirectory(compatibilityDataPath);
  const prefix = path.join(compatibilityDataPath, 'pfx');
  // The pinned Proton initializes when creation_sync_guard is missing, not
  // when the pfx directory is missing. Precreating this directory is safe.
  try { await fs.mkdir(prefix, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  await privateDirectory(prefix);
}
