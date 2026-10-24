import { existsSync } from 'node:fs';
import path from 'node:path';
import type { MacEngine } from '../shared/types.js';
import { findCrossOver, prepareCrossOverRunner, type CrossOverInstall } from './crossover.js';
import { highballEngineInstalled, prepareHighballRunner } from './highball-engine.js';
import { CROSSOVER_MISSING } from './mac-launch.js';
import { effectiveMacEngine, loadMacProfiles, macProfileFor, type MacProfiles } from './mac-profiles.js';
import type { ProtonRunner } from './proton.js';

export const D3DMETAL_MISSING = 'D3DMetal non trovato: serve CrossOver installato';
export const HIGHBALL_MISSING = 'Il motore Highball non è installato. Installalo in Impostazioni → Motore Wine, oppure scegli CrossOver.';

/** D3DMetal ships with CrossOver: <CrossOver>/lib64/apple_gptk/{external,wine}. */
export function appleGptkRoot(cx: CrossOverInstall | undefined): string {
  if (!cx) throw new Error(D3DMETAL_MISSING);
  const root = path.join(cx.root, 'lib64', 'apple_gptk');
  if (!existsSync(path.join(root, 'external')) || !existsSync(path.join(root, 'wine'))) throw new Error(D3DMETAL_MISSING);
  return root;
}

export interface MacRunnerDeps {
  findCrossOver: () => Promise<CrossOverInstall | undefined>;
  highballInstalled: (dataRoot: string) => string | undefined;
  prepareCrossOver: (cx: CrossOverInstall, bottlesRoot: string, runtimeDllDir: string) => Promise<ProtonRunner>;
  prepareHighball: (engineRoot: string, appleGptk: string, bottlesRoot: string, runtimeDllDir: string, extraEnv: Record<string, string>) => Promise<ProtonRunner>;
  profiles: () => Promise<MacProfiles>;
}

const defaultDeps: MacRunnerDeps = {
  findCrossOver: () => findCrossOver(),
  highballInstalled: (dataRoot) => highballEngineInstalled(dataRoot),
  prepareCrossOver: (cx, bottlesRoot, runtimeDllDir) => prepareCrossOverRunner(cx, bottlesRoot, runtimeDllDir),
  prepareHighball: prepareHighballRunner,
  profiles: () => loadMacProfiles(),
};

export interface MacRunnerRequest {
  setting: MacEngine | undefined;
  storeId: string | undefined;
  dataRoot: string;
  runtimeDllDir: string;
  log: (line: string) => void;
}

export interface MacRunner {
  runner: ProtonRunner;
  engine: MacEngine;
  /** Whitelisted per-game environment to add to the launch. */
  profileEnv: Record<string, string>;
}

/**
 * Picks the engine for a game (profile engine if installed, else the global
 * setting) and prepares its runner. Used by both launch and VC++ install, so
 * they always share the same prefix.
 */
export async function prepareMacRunner(request: MacRunnerRequest, deps: MacRunnerDeps = defaultDeps): Promise<MacRunner> {
  const profile = macProfileFor(await deps.profiles(), request.storeId);
  const crossOver = await deps.findCrossOver();
  const highball = deps.highballInstalled(request.dataRoot);
  const engine = effectiveMacEngine(request.setting, profile, { crossover: Boolean(crossOver), highball: Boolean(highball) });
  const profileEnv = { ...(profile?.env ?? {}) };
  const bottlesRoot = path.join(request.dataRoot, 'bottles');
  const profileText = profile
    ? `profilo ${request.storeId?.toUpperCase()}${profile.note ? ` (${profile.note})` : ''}${Object.keys(profileEnv).length ? `, variabili: ${Object.keys(profileEnv).join(', ')}` : ''}`
    : 'nessun profilo';
  if (engine === 'highball') {
    if (!highball) throw new Error(HIGHBALL_MISSING);
    const gptk = appleGptkRoot(crossOver);
    request.log(`Motore Wine: Highball (${highball}); D3DMetal da ${gptk}; ${profileText}.`);
    return { runner: await deps.prepareHighball(highball, gptk, bottlesRoot, request.runtimeDllDir, profileEnv), engine, profileEnv };
  }
  if (!crossOver) throw new Error(CROSSOVER_MISSING);
  request.log(`Motore Wine: CrossOver ${crossOver.version || ''}`.trimEnd() + `; ${profileText}.`);
  return { runner: await deps.prepareCrossOver(crossOver, bottlesRoot, request.runtimeDllDir), engine, profileEnv };
}
