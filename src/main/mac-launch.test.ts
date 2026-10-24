import { describe, expect, it } from 'vitest';
import { CROSSOVER_MISSING, runtimeDllDirectory, serviceSocketPathFits } from './mac-launch.js';

describe('runtimeDllDirectory', () => {
  it('points at the runtime x86_64-windows DLL folder next to files/bin/wine', () => {
    expect(runtimeDllDirectory('/r/releases/x/files/bin/wine')).toBe('/r/releases/x/files/lib/wine/x86_64-windows');
  });
});

describe('serviceSocketPathFits', () => {
  it('accepts the default macOS user-data socket path', () => {
    expect(serviceSocketPathFits('/Users/maurizio/Library/Application Support/MACxus/service-sessions/game-abc123/xodus.sock')).toBe(true);
  });

  it('rejects a path longer than the macOS sun_path limit', () => {
    expect(serviceSocketPathFits('/' + 'a'.repeat(119))).toBe(false);
  });
});

describe('CROSSOVER_MISSING', () => {
  it('tells the user to install CrossOver', () => {
    expect(CROSSOVER_MISSING).toBe('CrossOver non trovato. Installa CrossOver in Applicazioni e riprova.');
  });
});
