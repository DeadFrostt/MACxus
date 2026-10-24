import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

import type { VolumeInfo } from '../shared/types.js';
export type { VolumeInfo };

/** Top-level scalar keys of a `diskutil info -plist` document (nested containers are skipped). */
function topLevelValues(plist: string): Map<string, string | number | boolean> {
  const values = new Map<string, string | number | boolean>();
  let depth = 0;
  let key: string | undefined;
  for (const match of plist.matchAll(/<(\/?)(dict|array)>|<key>([^<]*)<\/key>|<string>([^<]*)<\/string>|<integer>(-?\d+)<\/integer>|<(true|false)\/>/g)) {
    if (match[2]) { depth += match[1] ? -1 : 1; if (!match[1] && depth > 1) key = undefined; continue; }
    if (depth !== 1) continue;
    if (match[3] !== undefined) { key = match[3]; continue; }
    if (key === undefined) continue;
    if (match[4] !== undefined) values.set(key, match[4].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    else if (match[5] !== undefined) values.set(key, Number(match[5]));
    else values.set(key, match[6] === 'true');
    key = undefined;
  }
  return values;
}

export function parseDiskutilInfo(plist: string): Omit<VolumeInfo, 'supported' | 'reason'> {
  const values = topLevelValues(plist);
  const text = (name: string) => typeof values.get(name) === 'string' ? values.get(name) as string : '';
  const number = (name: string) => typeof values.get(name) === 'number' ? values.get(name) as number : 0;
  const mountPoint = text('MountPoint');
  if (!mountPoint) throw new Error('Volume is not mounted.');
  // APFS volumes share their container's free space; FreeSpace is 0 for them.
  const freeBytes = number('APFSContainerFree') || number('FreeSpace');
  return {
    mountPoint, name: text('VolumeName') || path.basename(mountPoint), fsType: text('FilesystemType').toLowerCase(),
    internal: values.get('Internal') === true, freeBytes, totalBytes: number('TotalSize') || number('Size'),
  };
}

export function volumeSupport(fsType: string): { supported: boolean; reason?: string } {
  if (fsType === 'apfs' || fsType === 'hfs') return { supported: true };
  return { supported: false, reason: `Questo disco usa ${fsType}, che non supporta i collegamenti necessari ai giochi. Crea un'immagine APFS su questo disco.` };
}

const EXCLUDED_MOUNTS = ['/System/', '/Library/Developer/CoreSimulator', '/private/', '/dev/'];

const SYSTEM_VOLUME_NAMES = new Set(['Recovery', 'Preboot', 'Update', 'VM', 'xART', 'Hardware', 'iSCPreboot']);
/** Internal helper volumes and simulator images are not places to keep games. */
export function isSystemVolume(info: Pick<VolumeInfo, 'mountPoint' | 'name' | 'internal'>): boolean {
  return EXCLUDED_MOUNTS.some(prefix => (info.mountPoint + '/').startsWith(prefix))
    || info.internal && info.mountPoint !== '/' && SYSTEM_VOLUME_NAMES.has(info.name);
}

async function diskutilInfo(mount: string): Promise<VolumeInfo | undefined> {
  try {
    const { stdout } = await execFileAsync('diskutil', ['info', '-plist', mount], { maxBuffer: 2_000_000 });
    const info = parseDiskutilInfo(stdout);
    if (isSystemVolume(info)) return undefined;
    return { ...info, ...volumeSupport(info.fsType) };
  } catch { return undefined; }
}

export async function listVolumes(): Promise<VolumeInfo[]> {
  let entries: string[] = [];
  try { entries = await fs.readdir('/Volumes'); } catch { /* No external volumes. */ }
  const found = await Promise.all(['/', ...entries.map(entry => path.join('/Volumes', entry))].map(async mount => {
    const info = await diskutilInfo(mount);
    if (info && !info.supported) info.hasImage = await defaultDeps.exists(path.join(info.mountPoint, APFS_IMAGE_NAME));
    return info;
  }));
  const seen = new Set<string>();
  return found.filter((volume): volume is VolumeInfo => {
    if (!volume || seen.has(volume.mountPoint)) return false; // /Volumes/<boot disk> is a symlink to /.
    seen.add(volume.mountPoint);
    return true;
  });
}

export const APFS_IMAGE_NAME = 'MACxus.sparsebundle';

export interface ImageDeps {
  exec: (command: string, args: string[], options?: { timeout?: number }) => Promise<{ stdout: string }>;
  exists: (target: string) => Promise<boolean>;
  /** Called with the image path as soon as it exists, before attaching, so a failed attach never orphans it. */
  record: (image: string) => Promise<void>;
}
const defaultDeps: ImageDeps = {
  exec: (command, args, options) => execFileAsync(command, args, { maxBuffer: 2_000_000, ...options }),
  exists: async target => { try { await fs.access(target); return true; } catch { return false; } },
  record: async () => {},
};

/** Creates MACxus.sparsebundle on the volume, or reuses (re-attaches) the one already there. */
export async function createApfsImage(volumeMount: string, sizeGb: number, deps: Partial<ImageDeps> = {}): Promise<string> {
  const { exec, exists, record } = { ...defaultDeps, ...deps };
  const image = path.join(volumeMount, APFS_IMAGE_NAME);
  if (!await exists(image)) {
    if (!Number.isInteger(sizeGb) || sizeGb < 1 || sizeGb > 16_384) throw new Error('Dimensione immagine non valida.');
    await exec('hdiutil', ['create', '-size', `${sizeGb}g`, '-type', 'SPARSEBUNDLE', '-fs', 'APFS', '-volname', 'MACxus', image]);
  }
  await record(image);
  return attachImage(image, exec);
}

export async function createImageAt(image: string, sizeGb: number, volname: string): Promise<string> {
  await defaultDeps.exec('hdiutil', ['create', '-size', `${sizeGb}g`, '-type', 'SPARSEBUNDLE', '-fs', 'APFS', '-volname', volname, image]);
  return attachImage(image);
}

/** Attaches an image without showing it in Finder and returns its mount point. */
export async function attachImage(image: string, exec: ImageDeps['exec'] = defaultDeps.exec): Promise<string> {
  const { stdout } = await exec('hdiutil', ['attach', '-nobrowse', '-plist', image], { timeout: 30_000 });
  const points = [...stdout.matchAll(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/g)].map(match => match[1]);
  if (!points.length) throw new Error('Immagine creata ma non montata.');
  return points[0];
}

export function volumeFor(target: string, volumes: VolumeInfo[]): VolumeInfo | undefined {
  const resolved = path.resolve(target);
  const within = (mount: string) => mount === '/' || resolved === mount || resolved.startsWith(mount + '/');
  return volumes.filter(entry => within(entry.mountPoint)).sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0];
}

export function installRootStatus(root: string, volumes: VolumeInfo[]): 'ok' | 'disconnected' | 'unsupported' {
  const resolved = path.resolve(root);
  const volume = volumeFor(resolved, volumes);
  // Anything under /Volumes lives on its own disk, never on the boot volume.
  if (!volume || volume.mountPoint === '/' && (resolved === '/Volumes' || resolved.startsWith('/Volumes/'))) return 'disconnected';
  return volume.supported ? 'ok' : 'unsupported';
}

export function enoughSpace(freeBytes: number, downloadBytes: number): boolean {
  return freeBytes >= downloadBytes * 1.1;
}

/** Bytes missing (with the 10% margin) to finish a download, or undefined when the disk has enough room. */
export function spaceShortfall(freeBytes: number, totalBytes: number, downloadedBytes: number): number | undefined {
  const remaining = Math.max(0, totalBytes - downloadedBytes);
  if (enoughSpace(freeBytes, remaining)) return undefined;
  return Math.ceil(remaining * 1.1 - freeBytes);
}
