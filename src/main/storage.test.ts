import { describe, expect, it } from 'vitest';
import { createApfsImage, spaceShortfall, enoughSpace, installRootStatus, isSystemVolume, parseDiskutilInfo, volumeSupport, type VolumeInfo } from './storage.js';

// Trimmed from `diskutil info -plist` (serials and UUIDs removed).
const plist = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>APFSPhysicalStores</key>
	<array>
		<dict>
			<key>APFSPhysicalStore</key>
			<string>disk0s2</string>
		</dict>
	</array>
${body}</dict>
</plist>
`;
const APFS_INTERNAL = plist(`	<key>APFSContainerFree</key>
	<integer>100443660288</integer>
	<key>FilesystemType</key>
	<string>apfs</string>
	<key>FreeSpace</key>
	<integer>0</integer>
	<key>Internal</key>
	<true/>
	<key>MountPoint</key>
	<string>/</string>
	<key>TotalSize</key>
	<integer>494384795648</integer>
	<key>VolumeName</key>
	<string>Macintosh HD</string>
`);
const EXFAT_EXTERNAL = plist(`	<key>FilesystemType</key>
	<string>exfat</string>
	<key>FreeSpace</key>
	<integer>887059906560</integer>
	<key>Internal</key>
	<false/>
	<key>MountPoint</key>
	<string>/Volumes/KINGSTON</string>
	<key>TotalSize</key>
	<integer>1024190578688</integer>
	<key>VolumeName</key>
	<string>KINGSTON</string>
`);

const vol = (mountPoint: string, fsType: string, internal: boolean): VolumeInfo => ({
  mountPoint, name: mountPoint, fsType, internal, freeBytes: 1, totalBytes: 2, ...volumeSupport(fsType),
});

describe('parseDiskutilInfo', () => {
  it('reads an internal APFS volume, using the container free space', () => {
    expect(parseDiskutilInfo(APFS_INTERNAL)).toEqual({
      mountPoint: '/', name: 'Macintosh HD', fsType: 'apfs', internal: true, freeBytes: 100443660288, totalBytes: 494384795648,
    });
  });
  it('reads an external exFAT volume', () => {
    expect(parseDiskutilInfo(EXFAT_EXTERNAL)).toEqual({
      mountPoint: '/Volumes/KINGSTON', name: 'KINGSTON', fsType: 'exfat', internal: false, freeBytes: 887059906560, totalBytes: 1024190578688,
    });
  });
  it('rejects a plist without a mount point', () => {
    expect(() => parseDiskutilInfo(plist('\t<key>FilesystemType</key>\n\t<string>apfs</string>\n'))).toThrow();
  });
});

describe('volumeSupport', () => {
  it('rejects filesystems without symlinks', () => {
    for (const fs of ['exfat', 'msdos', 'ntfs']) {
      const result = volumeSupport(fs);
      expect(result.supported).toBe(false);
      expect(result.reason).toContain(fs);
      expect(result.reason).toContain('Crea un\'immagine APFS su questo disco.');
    }
  });
  it('accepts apfs and hfs', () => {
    expect(volumeSupport('apfs').supported).toBe(true);
    expect(volumeSupport('hfs').supported).toBe(true);
  });
});

describe('installRootStatus', () => {
  it('reports a missing external disk as disconnected', () => {
    expect(installRootStatus('/Volumes/KINGSTON/Games', [])).toBe('disconnected');
    expect(installRootStatus('/Volumes/KINGSTON/Games', [vol('/', 'apfs', true)])).toBe('disconnected');
  });
  it('reports an exFAT root as unsupported', () => {
    expect(installRootStatus('/Volumes/KINGSTON/Games', [vol('/', 'apfs', true), vol('/Volumes/KINGSTON', 'exfat', false)])).toBe('unsupported');
  });
  it('accepts roots on APFS, including a mounted image', () => {
    expect(installRootStatus('/Users/me/Games/MACxus', [vol('/', 'apfs', true)])).toBe('ok');
    expect(installRootStatus('/Volumes/MACxus/Games', [vol('/', 'apfs', true), vol('/Volumes/MACxus', 'apfs', false)])).toBe('ok');
  });
  it('does not match a sibling mount with a common name prefix', () => {
    expect(installRootStatus('/Volumes/KINGSTON2/Games', [vol('/', 'apfs', true), vol('/Volumes/KINGSTON', 'exfat', false)])).toBe('disconnected');
  });
});

describe('enoughSpace', () => {
  it('keeps a 10% margin for extraction', () => {
    expect(enoughSpace(10e9, 9e9)).toBe(true);
    expect(enoughSpace(10e9, 9.5e9)).toBe(false);
  });
});

describe('isSystemVolume', () => {
  it('hides recovery and simulator volumes but keeps real disks', () => {
    expect(isSystemVolume({ mountPoint: '/Volumes/Recovery', name: 'Recovery', internal: true })).toBe(true);
    expect(isSystemVolume({ mountPoint: '/Library/Developer/CoreSimulator/Volumes/iOS_23A', name: 'iOS 26', internal: false })).toBe(true);
    expect(isSystemVolume({ mountPoint: '/', name: 'Macintosh HD', internal: true })).toBe(false);
    expect(isSystemVolume({ mountPoint: '/Volumes/KINGSTON', name: 'KINGSTON', internal: false })).toBe(false);
  });
});

describe('spaceShortfall', () => {
  it('is undefined when the remaining download fits with margin', () => {
    expect(spaceShortfall(10e9, 9e9, 0)).toBeUndefined();
    expect(spaceShortfall(10e9, 20e9, 11e9)).toBeUndefined();
  });
  it('returns the missing bytes otherwise', () => {
    expect(spaceShortfall(10e9, 9.5e9, 0)).toBe(Math.ceil(9.5e9 * 1.1 - 10e9));
    expect(spaceShortfall(0, 1e9, 1e9)).toBeUndefined();
  });
});

describe('createApfsImage', () => {
  const MOUNT_PLIST = '<plist><dict><key>system-entities</key><array><dict><key>mount-point</key><string>/Volumes/MACxus</string></dict></array></dict></plist>';
  const harness = (existing: boolean, failAttach = false) => {
    const calls: string[][] = [];
    const recorded: string[] = [];
    return { calls, recorded, deps: {
      exists: async () => existing,
      record: async (image: string) => { recorded.push(image); },
      exec: async (command: string, args: string[]) => {
        calls.push([command, ...args]);
        if (args[0] === 'attach' && failAttach) throw new Error('attach failed');
        return { stdout: args[0] === 'attach' ? MOUNT_PLIST : '' };
      },
    } };
  };
  it('creates, records, then attaches a new image', async () => {
    const h = harness(false);
    expect(await createApfsImage('/Volumes/KINGSTON', 50, h.deps)).toBe('/Volumes/MACxus');
    expect(h.calls.map(c => c[1])).toEqual(['create', 'attach']);
    expect(h.calls[0]).toContain('/Volumes/KINGSTON/MACxus.sparsebundle');
    expect(h.recorded).toEqual(['/Volumes/KINGSTON/MACxus.sparsebundle']);
  });
  it('reuses an existing image: no create, only attach and record', async () => {
    const h = harness(true);
    expect(await createApfsImage('/Volumes/KINGSTON', 50, h.deps)).toBe('/Volumes/MACxus');
    expect(h.calls.map(c => c[1])).toEqual(['attach']);
    expect(h.recorded).toHaveLength(1);
  });
  it('records the image even when attach fails, so a retry reuses it', async () => {
    const h = harness(false, true);
    await expect(createApfsImage('/Volumes/KINGSTON', 50, h.deps)).rejects.toThrow('attach failed');
    expect(h.recorded).toHaveLength(1);
  });
  it('rejects an invalid size only when it must create', async () => {
    await expect(createApfsImage('/Volumes/K', 0, harness(false).deps)).rejects.toThrow();
    await expect(createApfsImage('/Volumes/K', 0, harness(true).deps)).resolves.toBe('/Volumes/MACxus');
  });
});
