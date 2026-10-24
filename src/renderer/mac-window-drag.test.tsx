import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { demoSnapshot } from '../shared/demo-data';
import { Sidebar } from './App';

it('gives the hidden-inset macOS window a drag strip clear of the traffic lights, and none on Linux', () => {
  const mac = { ...demoSnapshot(), platform: 'darwin' as const };
  expect(renderToStaticMarkup(<Sidebar data={mac} page="home" go={() => {}} />)).toContain('<div class="mac-drag-strip" aria-hidden="true"></div>');
  expect(renderToStaticMarkup(<Sidebar data={demoSnapshot()} page="home" go={() => {}} />)).not.toContain('mac-drag-strip');
  const css = readFileSync('src/renderer/styles.css', 'utf8');
  expect(css).toMatch(/\.mac-drag-strip\s*\{[^}]*-webkit-app-region:\s*drag/);
  expect(css).toMatch(/\.platform-darwin \.topbar\s*\{[^}]*-webkit-app-region:\s*drag/);
  expect(css).toMatch(/\.platform-darwin \.topbar :is\([^)]*input[^)]*\)\s*\{[^}]*-webkit-app-region:\s*no-drag/);
  expect(readFileSync('src/renderer/App.tsx', 'utf8')).toContain("data.platform === 'darwin' ? 'app-shell platform-darwin' : 'app-shell'");
});
