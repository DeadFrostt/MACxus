import { useState } from 'react';
import { ArrowDownToLine, Check, CircleAlert, Cpu, LoaderCircle } from 'lucide-react';
import type { MacEngine, MacEngineStatus } from '../shared/types';

const message = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);
const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

/** macOS: choose the Wine engine (CrossOver or the experimental Highball engine) and install Highball. */
export function MacEngineCard({ engine, status }: { engine?: MacEngine; status?: MacEngineStatus }) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const current = engine ?? 'crossover';

  async function choose(next: MacEngine) {
    if (next === current) return;
    setBusy('choose'); setError(undefined);
    try { await window.launcher.updateSettings({ macEngine: next }); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(undefined); }
  }

  async function install() {
    setBusy('install'); setError(undefined);
    try { await window.launcher.installHighballEngine(); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(undefined); }
  }

  const installing = Boolean(status?.installing);
  const percent = status?.totalBytes ? Math.min(100, Math.round(((status.downloadedBytes ?? 0) / status.totalBytes) * 100)) : 0;
  const shownError = error ?? status?.error;

  return <section className="settings-card">
    <div className="settings-heading"><div className="settings-icon"><Cpu /></div><div><h2>Motore Wine</h2><p>Scegli con quale Wine avviare i giochi. CrossOver resta il predefinito.</p></div></div>
    <div className="toggle-row" role="radiogroup" aria-label="Motore Wine">
      <label className="toggle"><input type="radio" name="mac-engine" value="crossover" checked={current === 'crossover'} disabled={Boolean(busy)} onChange={() => void choose('crossover')} /><span>CrossOver</span></label>
      <label className="toggle"><input type="radio" name="mac-engine" value="highball" checked={current === 'highball'} disabled={Boolean(busy)} onChange={() => void choose('highball')} /><span>Highball (sperimentale)</span></label>
      <p>Highball è un Wine costruito dai sorgenti di CrossOver con correzioni aggiuntive (highball-engine, LGPL-2.1). Usa una bottle separata e il D3DMetal di CrossOver, quindi CrossOver deve restare installato. Alcuni giochi (per esempio Forza Horizon 6) hanno un profilo che usa Highball automaticamente quando è installato.</p>
    </div>
    {status?.highballInstalled
      ? <p className="fine-print"><Check /> Motore Highball installato ({status.highballTag}).</p>
      : <p className="fine-print">Motore Highball non installato (download di circa 335 MB da GitHub, verificato con SHA-256).</p>}
    {current === 'highball' && status && !status.highballInstalled ? <div className="alert amber"><CircleAlert /><span>Hai scelto Highball ma il motore non è installato: installalo qui sotto prima di avviare un gioco.</span></div> : null}
    {installing ? <><p className="runtime-phase">{status?.phase ?? 'Installazione del motore Highball…'}{status?.totalBytes ? ` ${mb(status.downloadedBytes ?? 0)} di ${mb(status.totalBytes)}` : ''}</p><div className="progress-track"><i style={{ width: `${percent}%` }} /></div></> : null}
    {!installing && status?.phase && !shownError ? <p className="runtime-phase">{status.phase}</p> : null}
    {shownError ? <div className="alert amber" role="alert"><CircleAlert /><span>{shownError}</span></div> : null}
    {!status?.highballInstalled ? <div className="button-row end"><button className="primary" disabled={Boolean(busy) || installing} onClick={() => void install()}>{busy === 'install' || installing ? <LoaderCircle className="spin" /> : <ArrowDownToLine />}Installa motore Highball</button></div> : null}
  </section>;
}
