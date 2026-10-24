import { describe, expect, it } from 'vitest';
import { attachedImages, attachImage, createApfsImage, spaceShortfall, enoughSpace, installRootStatus, isSystemVolume, parseDiskutilInfo, volumeSupport, type VolumeInfo } from './storage.js';

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

describe('installRootStatus with a drifted image mount', () => {
  it('refuses a root on "MACxus 1" because the recorded image is mounted at /Volumes/MACxus', () => {
    const volumes = [vol('/', 'apfs', true), vol('/Volumes/MACxus 1', 'apfs', false)];
    expect(installRootStatus('/Volumes/MACxus 1/giochi', volumes)).toBe('disconnected');
    expect(installRootStatus('/Volumes/MACxus/giochi', [...volumes.slice(0, 1), vol('/Volumes/MACxus', 'apfs', false)])).toBe('ok');
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

const IMG = '/Volumes/KINGSTON/MACxus.sparsebundle';
const infoPlist = (images: Array<{ path: string; mounts: string[] }>) => `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>images</key><array>${images.map((image, index) => `<dict>
<key>image-path</key><string>${image.path}</string><key>image-type</key><string>sparse bundle disk image</string>
<key>system-entities</key><array>
<dict><key>content-hint</key><string>GUID_partition_scheme</string><key>dev-entry</key><string>/dev/disk${index + 8}</string></dict>
${image.mounts.map(mount => `<dict><key>dev-entry</key><string>/dev/disk${index + 8}s1</string><key>mount-point</key><string>${mount}</string></dict>`).join('\n')}
</array></dict>`).join('')}</array></dict></plist>`;

describe('attachedImages', () => {
  it('lists every attachment of the same image with its own mount point', () => {
    const result = attachedImages(infoPlist([{ path: IMG, mounts: ['/Volumes/MACxus'] }, { path: IMG, mounts: ['/Volumes/MACxus 1'] }]));
    expect(result).toEqual([{ imagePath: IMG, mountPoints: ['/Volumes/MACxus'] }, { imagePath: IMG, mountPoints: ['/Volumes/MACxus 1'] }]);
  });
  it('reports an image without mount point and keeps unrelated images apart', () => {
    const result = attachedImages(infoPlist([{ path: '/a/b.dmg', mounts: ['/Volumes/B'] }, { path: IMG, mounts: [] }]));
    expect(result).toEqual([{ imagePath: '/a/b.dmg', mountPoints: ['/Volumes/B'] }, { imagePath: IMG, mountPoints: [] }]);
  });
  it('is empty when nothing is attached', () => {
    expect(attachedImages('<plist><dict><key>images</key><array/></dict></plist>')).toEqual([]);
    expect(attachedImages('')).toEqual([]);
  });
});

describe('attachImage', () => {
  const run = async (info: string, mountTaken = false) => {
    const calls: string[][] = [];
    const exec = async (command: string, args: string[]) => { calls.push([command, ...args]); return { stdout: args[0] === 'info' ? info : '<key>mount-point</key><string>/Volumes/MACxus</string>' }; };
    const result = await attachImage(IMG, { exec, exists: async () => true, isMount: async () => mountTaken });
    return { calls, result };
  };
  it('skips an image already attached (remount at startup)', async () => {
    const { calls, result } = await run(infoPlist([{ path: IMG, mounts: ['/Volumes/MACxus'] }]));
    expect(result).toBe('/Volumes/MACxus');
    expect(calls.map(c => c[1])).toEqual(['info']);
  });
  it('ignores a stale empty /Volumes/MACxus directory that is not a mount', async () => {
    const { calls } = await run(infoPlist([]), false);
    expect(calls.map(c => c[1])).toEqual(['info', 'attach']);
  });
  it('serializes concurrent calls so the image is attached once', async () => {
    let attached = false; const calls: string[] = [];
    const exec = async (_c: string, args: string[]) => {
      calls.push(args[0]);
      if (args[0] === 'info') { await new Promise(r => setTimeout(r, 5)); return { stdout: attached ? infoPlist([{ path: IMG, mounts: ['/Volumes/MACxus'] }]) : infoPlist([]) }; }
      await new Promise(r => setTimeout(r, 5)); attached = true;
      return { stdout: '<key>mount-point</key><string>/Volumes/MACxus</string>' };
    };
    const deps = { exec, exists: async () => false, isMount: async () => false };
    expect(await Promise.all([attachImage(IMG, deps), attachImage(IMG, deps)])).toEqual(['/Volumes/MACxus', '/Volumes/MACxus']);
    expect(calls.filter(c => c === 'attach')).toHaveLength(1);
  });
  it('asks to eject an extra attachment mounted away from /Volumes/MACxus', async () => {
    await expect(run(infoPlist([{ path: IMG, mounts: ['/Volumes/MACxus 1'] }]))).rejects.toThrow('Espelli');
  });
  it('attaches when it is not attached yet', async () => {
    const { calls } = await run(infoPlist([]));
    expect(calls.map(c => c[1])).toEqual(['info', 'attach']);
  });
});

describe('createApfsImage', () => {
  const MOUNT_PLIST = '<plist><dict><key>system-entities</key><array><dict><key>mount-point</key><string>/Volumes/MACxus</string></dict></array></dict></plist>';
  const harness = (existing: boolean, failAttach = false, info = '', mountTaken = false) => {
    const calls: string[][] = [];
    const recorded: string[] = [];
    return { calls, recorded, deps: {
      exists: async (target: string) => target === '/Volumes/MACxus' ? true : existing,
      isMount: async (target: string) => target === '/Volumes/MACxus' && mountTaken,
      record: async (image: string) => { recorded.push(image); },
      exec: async (command: string, args: string[]) => {
        calls.push([command, ...args]);
        if (args[0] === 'attach' && failAttach) throw new Error('attach failed');
        return { stdout: args[0] === 'attach' ? MOUNT_PLIST : args[0] === 'info' ? info : '' };
      },
    } };
  };
  it('creates, records, then attaches a new image', async () => {
    const h = harness(false);
    expect(await createApfsImage('/Volumes/KINGSTON', 50, h.deps)).toBe('/Volumes/MACxus');
    expect(h.calls.map(c => c[1])).toEqual(['create', 'info', 'attach']);
    expect(h.calls[0]).toContain('/Volumes/KINGSTON/MACxus.sparsebundle');
    expect(h.recorded).toEqual(['/Volumes/KINGSTON/MACxus.sparsebundle']);
  });
  it('reuses an existing image: no create, only attach and record', async () => {
    const h = harness(true);
    expect(await createApfsImage('/Volumes/KINGSTON', 50, h.deps)).toBe('/Volumes/MACxus');
    expect(h.calls.map(c => c[1])).toEqual(['info', 'attach']);
    expect(h.recorded).toHaveLength(1);
  });
  it('attaches with an explicit stable mount point', async () => {
    const h = harness(true);
    await createApfsImage('/Volumes/KINGSTON', 50, h.deps);
    expect(h.calls.find(c => c[1] === 'attach')).toEqual(['hdiutil', 'attach', '-nobrowse', '-mountpoint', '/Volumes/MACxus', '-plist', '/Volumes/KINGSTON/MACxus.sparsebundle']);
  });
  it('does not attach an image that is already attached: reuses its mount point', async () => {
    const h = harness(true, false, infoPlist([{ path: IMG, mounts: ['/Volumes/MACxus'] }]), true);
    expect(await createApfsImage('/Volumes/KINGSTON', 50, h.deps)).toBe('/Volumes/MACxus');
    expect(h.calls.map(c => c[1])).toEqual(['info']);
    expect(h.recorded).toHaveLength(1);
  });
  it('refuses to attach elsewhere when /Volumes/MACxus belongs to another disk', async () => {
    const h = harness(true, false, infoPlist([{ path: '/Volumes/Other/x.sparsebundle', mounts: ['/Volumes/MACxus'] }]), true);
    await expect(createApfsImage('/Volumes/KINGSTON', 50, h.deps)).rejects.toThrow('Il percorso /Volumes/MACxus è già usato da un altro disco');
    expect(h.calls.map(c => c[1])).toEqual(['info']);
  });
  it('reports an attached image that has no mount point instead of attaching again', async () => {
    const h = harness(true, false, infoPlist([{ path: IMG, mounts: [] }]));
    await expect(createApfsImage('/Volumes/KINGSTON', 50, h.deps)).rejects.toThrow('non montata');
    expect(h.calls.map(c => c[1])).toEqual(['info']);
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
