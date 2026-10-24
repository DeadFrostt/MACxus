import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_SIGNING_NAME, findLocalSigningIdentity, isSignedWithLocalIdentity, parseSigningIdentities, signBackendBinary } from './codesign.js';
import { run } from './process.js';

vi.mock('./process.js', () => ({ run: vi.fn() }));
const fake = vi.mocked(run);
const H1 = 'A'.repeat(40);
const H2 = 'B'.repeat(40);
const sample = `Policy: Code Signing
  Matching identities
  1) ${H1} "Apple Development: Someone (ABC123)"
  2) ${H2} "${LOCAL_SIGNING_NAME}"
     2 identities found

  Valid identities only
  1) ${H1} "Apple Development: Someone (ABC123)"
     1 valid identities found
`;

beforeEach(() => fake.mockReset());

describe('parseSigningIdentities', () => {
  it('parses several identities', () => {
    expect(parseSigningIdentities(sample)).toEqual([
      { hash: H1, name: 'Apple Development: Someone (ABC123)' },
      { hash: H2, name: LOCAL_SIGNING_NAME },
      { hash: H1, name: 'Apple Development: Someone (ABC123)' },
    ]);
  });
  it('returns nothing when there are none', () => {
    expect(parseSigningIdentities('     0 valid identities found\n')).toEqual([]);
    expect(parseSigningIdentities('')).toEqual([]);
  });
  it('keeps quotes inside names', () => {
    expect(parseSigningIdentities(`  1) ${H1} "My \\"Quoted\\" Cert"`)).toEqual([{ hash: H1, name: 'My \\"Quoted\\" Cert' }]);
    expect(parseSigningIdentities(`  1) ${H1} "O'Brien, \\"x\\""`)[0].hash).toBe(H1);
  });
});

describe('findLocalSigningIdentity', () => {
  it('runs the read-only find-identity and returns the hash of the exact name', async () => {
    fake.mockResolvedValue({ code: 0, output: sample });
    expect(await findLocalSigningIdentity()).toBe(H2);
    expect(fake.mock.calls[0].slice(0, 2)).toEqual(['security', ['find-identity', '-p', 'codesigning']]);
  });
  it('ignores similar names', async () => {
    fake.mockResolvedValue({ code: 0, output: `  1) ${H1} "${LOCAL_SIGNING_NAME} copy"\n  2) ${H2} "Other"` });
    expect(await findLocalSigningIdentity()).toBeUndefined();
  });
  it('returns undefined when security fails or throws', async () => {
    fake.mockResolvedValueOnce({ code: 1, output: 'boom' });
    expect(await findLocalSigningIdentity()).toBeUndefined();
    fake.mockRejectedValueOnce(new Error('ENOENT'));
    expect(await findLocalSigningIdentity()).toBeUndefined();
  });
});

describe('signBackendBinary', () => {
  it('builds the exact argv', async () => {
    fake.mockResolvedValue({ code: 0, output: '' });
    await signBackendBinary('/b/xodus-cli', 'io.macxus.xodus-cli', H2);
    expect(fake.mock.calls[0].slice(0, 2)).toEqual(['codesign', ['--force', '--sign', H2, '--identifier', 'io.macxus.xodus-cli', '/b/xodus-cli']]);
  });
  it('throws with the output tail on failure', async () => {
    fake.mockResolvedValue({ code: 1, output: 'x'.repeat(2000) + 'TAIL-MARK' });
    await expect(signBackendBinary('/b/x', 'id', H2)).rejects.toThrow(/TAIL-MARK/);
  });
});

describe('isSignedWithLocalIdentity', () => {
  it('checks codesign -dv for the authority line', async () => {
    fake.mockResolvedValueOnce({ code: 0, output: `Identifier=x\nAuthority=${LOCAL_SIGNING_NAME}\n` });
    expect(await isSignedWithLocalIdentity('/b/x')).toBe(true);
    expect(fake.mock.calls[0].slice(0, 2)).toEqual(['codesign', ['-dv', '/b/x']]);
    fake.mockResolvedValueOnce({ code: 0, output: 'Signature=adhoc\n' });
    expect(await isSignedWithLocalIdentity('/b/x')).toBe(false);
    fake.mockRejectedValueOnce(new Error('x'));
    expect(await isSignedWithLocalIdentity('/b/x')).toBe(false);
  });
});
