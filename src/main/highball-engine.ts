import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { dllOverrideArgs, ensureRuntimeOverrides, installRuntimeDlls, shellQuote, writeRunnerScript } from './crossover.js';
import { run } from './process.js';
import type { ProtonRunner } from './proton.js';

// Highball engine: Wine built from CrossOver 26.3 sources plus patches (LGPL-2.1),
// github.com/gauthierpiarrette/highball-engine. The release is pinned: tag, size
// and SHA-256 are fixed here and the published .sha256 asset must agree.
export const HIGHBALL_ENGINE_TAG = 'engine-wine-11.0-20261014T003801Z-0024-app-packages-0023-spatial-mixer';
export const HIGHBALL_ENGINE_ASSET = `${HIGHBALL_ENGINE_TAG}.tar.gz`;
export const HIGHBALL_ENGINE_SHA256_ASSET = `${HIGHBALL_ENGINE_ASSET}.sha256`;
export const HIGHBALL_ENGINE_SIZE = 334_884_359;
export const HIGHBALL_ENGINE_SHA256 = '1d1a130c0108a4bbb88cd289c3c313292868c3b84010eb315801eba43026e3e8';

export interface HighballRelease {
  tag: string;
  asset: string;
  sha256Asset: string;
  size: number;
  sha256: string;
  baseUrl: string;
}

export const HIGHBALL_ENGINE_RELEASE: HighballRelease = {
  tag: HIGHBALL_ENGINE_TAG,
  asset: HIGHBALL_ENGINE_ASSET,
  sha256Asset: HIGHBALL_ENGINE_SHA256_ASSET,
  size: HIGHBALL_ENGINE_SIZE,
  sha256: HIGHBALL_ENGINE_SHA256,
  baseUrl: `https://github.com/gauthierpiarrette/highball-engine/releases/download/${HIGHBALL_ENGINE_TAG}`,
};

export type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

const PREFIX = 'xbox-highball';
const RUNNER = 'xodus-highball-wine';
const REQUIRED_FILES = ['engine/bin/wine', 'engine/bin/wineserver', 'engine/lib/wine/x86_64-windows/kernelbase.dll'];
/** Same rules as the per-game profile values: they are embedded in a shell script. */
const SAFE_ENV_KEY = /^[A-Z_][A-Z0-9_]*$/;
const SAFE_ENV_VALUE = /^[\w .:+-]{1,64}$/;

function enginesDirectory(dataRoot: string): string {
  return path.join(dataRoot, 'engines', 'highball');
}

export function highballEngineDirectory(dataRoot: string, release: HighballRelease = HIGHBALL_ENGINE_RELEASE): string {
  return path.join(enginesDirectory(dataRoot), release.tag);
}

function layoutComplete(root: string): boolean {
  return REQUIRED_FILES.every((file) => existsSync(path.join(root, file)));
}

/** The engine root (holding engine/bin/wine) when the pinned engine is fully installed. */
export function highballEngineInstalled(dataRoot: string, release: HighballRelease = HIGHBALL_ENGINE_RELEASE): string | undefined {
  const root = highballEngineDirectory(dataRoot, release);
  return layoutComplete(root) ? root : undefined;
}

function unsafeEntry(entry: string): boolean {
  if (!entry) return false;
  if (path.isAbsolute(entry)) return true;
  return entry.split('/').includes('..');
}

/**
 * Downloads the pinned engine to a temporary file, verifies size and SHA-256
 * (pinned and published), extracts it with the system tar into a staging folder
 * and renames that folder into place. Nothing from the download is executed
 * before it is verified.
 */
export async function installHighballEngine(
  dataRoot: string,
  fetcher: Fetcher = fetch,
  onProgress?: (downloaded: number, total: number) => void,
  release: HighballRelease = HIGHBALL_ENGINE_RELEASE,
  signal?: AbortSignal,
): Promise<string> {
  const installed = highballEngineInstalled(dataRoot, release);
  if (installed) return installed;
  const engines = enginesDirectory(dataRoot);
  await fs.mkdir(engines, { recursive: true, mode: 0o700 });
  const suffix = `${process.pid}-${Date.now()}`;
  const temporary = path.join(engines, `.download-${suffix}.tar.gz`);
  const staging = path.join(engines, `.staging-${suffix}`);
  const destination = highballEngineDirectory(dataRoot, release);
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const checksumResponse = await fetcher(`${release.baseUrl}/${release.sha256Asset}`, { signal });
    if (!checksumResponse.ok) throw new Error(`Download del motore Highball non riuscito (HTTP ${checksumResponse.status} sul file .sha256).`);
    const published = (await checksumResponse.text()).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (!/^[0-9a-f]{64}$/.test(published) || published !== release.sha256) {
      throw new Error('Il checksum pubblicato del motore Highball non corrisponde a quello atteso: download interrotto.');
    }

    const response = await fetcher(`${release.baseUrl}/${release.asset}`, { signal });
    if (!response.ok || !response.body) throw new Error(`Download del motore Highball non riuscito (HTTP ${response.status}).`);
    handle = await fs.open(temporary, 'wx', 0o600);
    const hash = createHash('sha256');
    let downloaded = 0;
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      downloaded += chunk.length;
      if (downloaded > release.size) throw new Error(`Il motore Highball scaricato ha una dimensione inattesa (oltre ${release.size} byte).`);
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
        if (bytesWritten === 0) throw new Error('Il download del motore Highball ha smesso di scrivere sul disco.');
        offset += bytesWritten;
      }
      hash.update(chunk);
      onProgress?.(downloaded, release.size);
    }
    await handle.close();
    handle = undefined;
    if (downloaded !== release.size) throw new Error(`Il motore Highball scaricato ha una dimensione inattesa (${downloaded} byte invece di ${release.size}).`);
    if (hash.digest('hex') !== release.sha256) throw new Error('Verifica SHA-256 del motore Highball non riuscita: il file scaricato è stato scartato.');

    const listing = await run('tar', ['-tzf', temporary], { maxOutput: 64_000_000 });
    if (listing.code !== 0) throw new Error(`Lettura dell'archivio del motore Highball non riuscita (codice ${listing.code}).`);
    if (listing.output.split('\n').map((line) => line.trim()).some(unsafeEntry)) throw new Error("L'archivio del motore Highball contiene percorsi non sicuri: installazione annullata.");

    await fs.mkdir(staging, { mode: 0o700 });
    const extracted = await run('tar', ['-xzf', temporary, '-C', staging]);
    if (extracted.code !== 0) throw new Error(`Estrazione del motore Highball non riuscita (codice ${extracted.code}).`);
    if (!layoutComplete(staging)) throw new Error(`L'archivio del motore Highball è incompleto (servono ${REQUIRED_FILES.join(', ')}).`);
    try { await fs.rename(staging, destination); }
    catch (error) {
      // Another install finished first: keep it.
      if (!layoutComplete(destination)) throw error;
    }
    return destination;
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
  }
}

function safeEnvironment(extraEnv: Record<string, string>): [string, string][] {
  return Object.entries(extraEnv).filter(([key, value]) => SAFE_ENV_KEY.test(key) && typeof value === 'string' && SAFE_ENV_VALUE.test(value));
}

/**
 * Wrapper that runs the Highball wine on its own prefix with CrossOver's D3DMetal
 * (WINEDLLPATH_PREPEND, CX_D3DMETALPATH, DYLD fallback paths). msync defaults on;
 * WINEMSYNC/WINEESYNC and profile values only apply when not already set.
 */
export function highballWrapperScript(engineRoot: string, appleGptkRoot: string, prefix: string, extraEnv: Record<string, string>): string {
  const wine = shellQuote(path.join(engineRoot, 'engine', 'bin', 'wine'));
  const wineserver = shellQuote(path.join(engineRoot, 'engine', 'bin', 'wineserver'));
  const external = shellQuote(path.join(appleGptkRoot, 'external'));
  const defaults = Object.fromEntries(safeEnvironment({ WINEMSYNC: '1', WINEESYNC: '0', ...extraEnv }));
  return [
    '#!/bin/sh',
    `export WINEPREFIX=${shellQuote(prefix)}`,
    `export WINEDLLPATH_PREPEND=${shellQuote(path.join(appleGptkRoot, 'wine'))}`,
    `export CX_D3DMETALPATH=${external}`,
    `export DYLD_FALLBACK_LIBRARY_PATH=${external}"\${DYLD_FALLBACK_LIBRARY_PATH:+:\$DYLD_FALLBACK_LIBRARY_PATH}"`,
    `export DYLD_FALLBACK_FRAMEWORK_PATH=${external}"\${DYLD_FALLBACK_FRAMEWORK_PATH:+:\$DYLD_FALLBACK_FRAMEWORK_PATH}"`,
    // Values match SAFE_ENV_VALUE, so they cannot break out of the double quotes.
    ...Object.entries(defaults).map(([key, value]) => `export ${key}="\${${key}:-${value}}"`),
    'if [ "${1:-}" = "--nexus-stop-prefix" ]; then',
    `  exec ${wineserver} -k`,
    'fi',
    'launch_status=0',
    `${wine} "$@" || launch_status=$?`,
    'wait_status=0',
    `${wineserver} -w || wait_status=$?`,
    'if [ "$launch_status" -ne 0 ]; then exit "$launch_status"; fi',
    'exit "$wait_status"',
    '',
  ].join('\n');
}

/**
 * Prepares the Highball prefix <bottlesRoot>/xbox-highball (separate from the
 * CrossOver bottle), installs the runtime DLLs as native and writes the wrapper.
 */
export async function prepareHighballRunner(
  engineRoot: string,
  appleGptkRoot: string,
  bottlesRoot: string,
  runtimeDllDir: string,
  extraEnv: Record<string, string> = {},
): Promise<ProtonRunner> {
  const wine = path.join(engineRoot, 'engine', 'bin', 'wine');
  const wineserver = path.join(engineRoot, 'engine', 'bin', 'wineserver');
  const prefix = path.join(bottlesRoot, PREFIX);
  const env: NodeJS.ProcessEnv = { ...process.env, WINEPREFIX: prefix, WINEDEBUG: process.env.WINEDEBUG ?? '-all' };
  await fs.mkdir(bottlesRoot, { recursive: true });

  let existed = true;
  try { await fs.access(path.join(prefix, 'system.reg')); } catch { existed = false; }
  if (!existed) {
    await fs.mkdir(prefix, { recursive: true });
    const booted = await run(wine, ['wineboot', '-u'], { env });
    // wineserver writes system.reg when it exits.
    await run(wineserver, ['-w'], { env }).catch(() => undefined);
    try { await fs.access(path.join(prefix, 'system.reg')); } catch {
      throw new Error(`Il prefisso Highball non è stato creato: ${booted.output.trim().split('\n').slice(-3).join(' | ') || `codice ${booted.code}`}`);
    }
  }

  const changed = await installRuntimeDlls(prefix, runtimeDllDir);
  await ensureRuntimeOverrides(prefix, !existed || changed.length > 0, (name) => run(wine, dllOverrideArgs(name), { env }), 'Highball prefix');

  const runner = path.join(bottlesRoot, RUNNER);
  await writeRunnerScript(runner, highballWrapperScript(engineRoot, appleGptkRoot, prefix, extraEnv));
  return { command: runner, compatibilityDataPath: prefix, stopPrefix: { command: runner, args: ['--nexus-stop-prefix'] } };
}
