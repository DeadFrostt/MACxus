import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendManager } from './backend.js';
import { LOCAL_SIGNING_NAME } from './codesign.js';
import { run } from './process.js';

vi.mock('./process.js', () => ({ run: vi.fn() }));
const fake = vi.mocked(run);
const HASH = 'C'.repeat(40);
const identities = `  1) ${HASH} "${LOCAL_SIGNING_NAME}"\n`;

function script(opts: { identity: boolean; signed?: string[]; failSign?: string }) {
  fake.mockImplementation((async (cmd: string, args: string[]) => {
    if (cmd === 'security') return { code: 0, output: opts.identity ? identities : '     0 valid identities found\n' };
    if (cmd === 'codesign' && args[0] === '-dv') return { code: 0, output: opts.signed?.includes(args[1]) ? `Authority=${LOCAL_SIGNING_NAME}\n` : 'Signature=adhoc\n' };
    if (cmd === 'codesign') return { code: args.at(-1) === opts.failSign ? 1 : 0, output: args.at(-1) === opts.failSign ? 'denied' : '' };
    return { code: 1, output: '' };
  }) as typeof run);
}
const signCalls = () => fake.mock.calls.filter(([cmd, args]) => cmd === 'codesign' && args[0] === '--force').map(([, args]) => args);
const keychainCalls = () => fake.mock.calls.filter(([cmd]) => cmd === 'security' || cmd === 'codesign');
type Internals = { signBinaries(cli: string, service: string, log: (l: string) => void): Promise<void>; status: { source: string; binaryPath?: string } };
const make = (platform: NodeJS.Platform, logs: string[] = []) => new BackendManager('/unused', '', (_s, l) => logs.push(l), () => false, fetch, platform);

beforeEach(() => fake.mockReset());

describe('backend signing', () => {
  it('rebuild step signs both binaries with the stable identifiers when the certificate exists', async () => {
    script({ identity: true });
    const logs: string[] = [];
    const manager = make('darwin');
    await (manager as unknown as Internals).signBinaries('/t/xodus-cli', '/t/xodus-service', l => logs.push(l));
    expect(signCalls()).toEqual([
      ['--force', '--sign', HASH, '--identifier', 'io.macxus.xodus-cli', '/t/xodus-cli'],
      ['--force', '--sign', HASH, '--identifier', 'io.macxus.xodus-service', '/t/xodus-service'],
    ]);
    expect(manager.current.signingIdentity).toBe(true);
    expect(logs.join('\n')).toMatch(/Firmato/);
  });
  it('keeps the ad-hoc signature and hints when there is no certificate', async () => {
    script({ identity: false });
    const logs: string[] = [];
    const manager = make('darwin');
    await (manager as unknown as Internals).signBinaries('/t/xodus-cli', '/t/xodus-service', l => logs.push(l));
    expect(signCalls()).toEqual([]);
    expect(manager.current.signingIdentity).toBe(false);
    expect(logs.join('\n')).toMatch(/ad-hoc/);
  });
  it('a signing failure does not throw and the other binary is still signed', async () => {
    script({ identity: true, failSign: '/t/xodus-cli' });
    const logs: string[] = [];
    await (make('darwin') as unknown as Internals).signBinaries('/t/xodus-cli', '/t/xodus-service', l => logs.push(l));
    expect(signCalls()).toHaveLength(2);
    expect(logs.join('\n')).toMatch(/non riuscita/);
  });
  it('startup re-sign skips binaries already signed with the certificate', async () => {
    script({ identity: true, signed: ['/m/xodus-cli'] });
    const manager = make('darwin');
    const internals = manager as unknown as Internals;
    internals.status.source = 'managed'; internals.status.binaryPath = '/m/xodus-cli';
    await manager.ensureSigned();
    expect(signCalls()).toEqual([['--force', '--sign', HASH, '--identifier', 'io.macxus.xodus-service', '/m/xodus-service']]);
  });
  it('startup without a managed backend only records whether the certificate exists', async () => {
    script({ identity: true });
    const manager = make('darwin');
    await manager.ensureSigned();
    expect(signCalls()).toEqual([]);
    expect(manager.current.signingIdentity).toBe(true);
  });
  it('never calls security or codesign on Linux', async () => {
    script({ identity: true });
    const manager = make('linux');
    await (manager as unknown as Internals).signBinaries('/t/xodus-cli', '/t/xodus-service', () => {});
    await manager.ensureSigned();
    expect(keychainCalls()).toEqual([]);
    expect(manager.current.signingIdentity).toBe(false);
  });
});
