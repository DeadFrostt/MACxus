import { run } from './process.js';

/** Name of the self-signed code-signing certificate the user creates by hand in Keychain Access. */
export const LOCAL_SIGNING_NAME = 'MACxus Local Signing';

/** Parses `security find-identity -p codesigning` lines like `  1) <40-hex> "Name"`. */
export function parseSigningIdentities(output: string): Array<{ hash: string; name: string }> {
  const identities: Array<{ hash: string; name: string }> = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*\d+\)\s+([0-9A-Fa-f]{40})\s+"(.*)"\s*$/.exec(line);
    if (match) identities.push({ hash: match[1], name: match[2] });
  }
  return identities;
}

/** Read-only lookup. No `-v`: a self-signed root may not be trusted yet and still signs. */
export async function findLocalSigningIdentity(): Promise<string | undefined> {
  try {
    const result = await run('security', ['find-identity', '-p', 'codesigning'], { maxOutput: 200_000 });
    if (result.code !== 0) return undefined;
    return parseSigningIdentities(result.output).find(identity => identity.name === LOCAL_SIGNING_NAME)?.hash;
  } catch { return undefined; }
}

export async function signBackendBinary(binary: string, identifier: string, identity: string): Promise<void> {
  const result = await run('codesign', ['--force', '--sign', identity, '--identifier', identifier, binary], { maxOutput: 100_000 });
  if (result.code !== 0) throw new Error(`codesign exited with code ${result.code}: ${result.output.slice(-500).trim()}`);
}

/** Read-only check (`codesign -dv`) that the binary already carries the local certificate. */
export async function isSignedWithLocalIdentity(binary: string): Promise<boolean> {
  try {
    const result = await run('codesign', ['-dv', binary], { maxOutput: 100_000 });
    return result.output.split(/\r?\n/).some(line => line.trim() === `Authority=${LOCAL_SIGNING_NAME}`);
  } catch { return false; }
}
