import { useEffect, useState } from 'react';
import { Check, CircleAlert, FolderOpen, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react';
import type { VolumeInfo } from '../shared/types';

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(bytes >= 100e9 ? 0 : 1)} GB`;
const message = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);
const within = (root: string, mount: string) => mount === '/' || root === mount || root.startsWith(mount + '/');

export function StoragePicker({ installRoot, onChosen, storageError }: { installRoot: string; onChosen?: (root: string) => void; storageError?: string }) {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [sizes, setSizes] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    try { setVolumes(await window.launcher.listVolumes()); setError(undefined); }
    catch (failure) { setError(message(failure)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const current = volumes.filter(volume => within(installRoot, volume.mountPoint)).sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0];

  async function choose(volume: VolumeInfo) {
    setBusy(volume.mountPoint); setError(undefined);
    try {
      const start = within(installRoot, volume.mountPoint) ? installRoot : volume.mountPoint;
      const folder = await window.launcher.chooseDirectory(start);
      if (!folder) return;
      if (!within(folder, volume.mountPoint)) { setError(`La cartella deve trovarsi dentro ${volume.name}.`); return; }
      await window.launcher.setInstallRoot(folder);
      onChosen?.(folder);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(undefined); }
  }

  async function createImage(volume: VolumeInfo) {
    const size = sizes[volume.mountPoint] ?? Math.max(1, Math.min(50, Math.floor(volume.freeBytes / 1e9 / 2)));
    setBusy(`image:${volume.mountPoint}`); setError(undefined);
    try { await window.launcher.createApfsImage(volume.mountPoint, size); await load(); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(undefined); }
  }

  return <div className="storage-picker">
    <div className="settings-heading"><div className="settings-icon"><HardDrive /></div><div><h2>Dove salvare i giochi</h2><p>Cartella attuale: {installRoot}</p></div>
      <button className="secondary" onClick={() => void load()} disabled={loading} title="Aggiorna l'elenco dei dischi">{loading ? <LoaderCircle className="spin" /> : <RefreshCw />}</button></div>
    {storageError && !error ? <div className="alert amber" role="alert"><CircleAlert /><span>{storageError}</span></div> : null}
    {error ? <div className="alert amber" role="alert"><CircleAlert /><span>{error}</span></div> : null}
    <ul className="storage-volumes">
      {volumes.map(volume => <li key={volume.mountPoint} className={`storage-volume${current === volume ? ' selected' : ''}`}>
        <div><strong>{volume.name}</strong> <small>{volume.internal ? 'Interno' : 'Esterno'} · {volume.fsType.toUpperCase()} · {gb(volume.freeBytes)} liberi di {gb(volume.totalBytes)}</small>
          <small>{volume.supported ? 'Supportato' : volume.reason}</small>
          {current === volume ? <small><Check /> In uso per i giochi</small> : null}</div>
        {volume.supported
          ? <button className="secondary" disabled={Boolean(busy)} onClick={() => void choose(volume)}>{busy === volume.mountPoint ? <LoaderCircle className="spin" /> : <FolderOpen />}Scegli cartella</button>
          : <div className="button-row">
            {volume.hasImage ? <small>Immagine già presente su questo disco.</small> : <label>Dimensione (GB)<input type="number" min="1" max={Math.max(1, Math.floor(volume.freeBytes / 1e9))} aria-label={`Dimensione immagine su ${volume.name}`}
              value={sizes[volume.mountPoint] ?? Math.max(1, Math.min(50, Math.floor(volume.freeBytes / 1e9 / 2)))}
              onChange={event => setSizes({ ...sizes, [volume.mountPoint]: Math.max(1, Math.round(Number(event.target.value)) || 1) })} /></label>}
            <button className="primary" disabled={Boolean(busy)} onClick={() => void createImage(volume)}>{busy === `image:${volume.mountPoint}` ? <LoaderCircle className="spin" /> : <HardDrive />}{volume.hasImage ? 'Monta immagine esistente' : 'Crea immagine APFS'}</button>
          </div>}
      </li>)}
    </ul>
  </div>;
}
