import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MacEngineCard } from './MacEngineCard';

const base = { highballInstalled: false, highballTag: 'engine-tag', installing: false };

describe('MacEngineCard', () => {
  it('offers CrossOver (default) and experimental Highball with an install action', () => {
    const html = renderToStaticMarkup(<MacEngineCard status={base} />);
    expect(html).toContain('Motore Wine');
    expect(html).toContain('CrossOver');
    expect(html).toContain('Highball (sperimentale)');
    expect(html).toContain('Installa motore Highball');
    expect(html).toContain('checked="" value="crossover"');
    expect(html).not.toContain('checked="" value="highball"');
  });
  it('shows download progress and Italian errors', () => {
    const progress = renderToStaticMarkup(<MacEngineCard engine="highball" status={{ ...base, installing: true, downloadedBytes: 100e6, totalBytes: 200e6, phase: 'Download del motore Highball…' }} />);
    expect(progress).toContain('100 MB di 200 MB');
    expect(progress).toContain('width:50%');
    const failed = renderToStaticMarkup(<MacEngineCard engine="highball" status={{ ...base, error: 'Verifica SHA-256 del motore Highball non riuscita' }} />);
    expect(failed).toContain('Verifica SHA-256 del motore Highball non riuscita');
    expect(failed).toContain('il motore non è installato');
  });
  it('hides the install action once Highball is installed', () => {
    const html = renderToStaticMarkup(<MacEngineCard engine="highball" status={{ ...base, highballInstalled: true }} />);
    expect(html).not.toContain('Installa motore Highball');
    expect(html).toContain('Motore Highball installato (engine-tag)');
  });
});
