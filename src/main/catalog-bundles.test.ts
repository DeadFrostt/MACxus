import { expect, it } from 'vitest';
import { CatalogService } from './catalog.js';

const id = (n: number) => `9${n.toString(36).toUpperCase().padStart(11, '0')}`;
const game = (productId: string, children: string[] = []) => ({
  ProductId: productId, ProductType: 'Game', LocalizedProperties: [{ ProductTitle: productId }],
  DisplaySkuAvailabilities: [{ Sku: { Properties: children.length ? {
    Packages: [], BundledSkus: children.map(BigId => ({ BigId })),
  } : { Packages: [{ PackageFormat: 'MSIXVC', PlatformDependencies: [{ PlatformName: 'Windows.Desktop' }] }] } } }],
});
function fixture(products: ReturnType<typeof game>[]) {
  const requests: string[][] = [];
  let active = 0, peak = 0;
  const service = new CatalogService((async (input: URL | RequestInfo) => {
    const batch = new URL(String(input)).searchParams.get('bigIds')!.split(',');
    requests.push(batch); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return new Response(JSON.stringify({ Products: products.filter(p => batch.includes(p.ProductId)) }));
  }) as typeof fetch);
  return { service, requests, peak: () => peak };
}

it('resolves every licensed edition independently of other games on a full page', async () => {
  const roots = Array.from({ length: 60 }, (_, i) => id(i));
  const children = roots.map((_, i) => id(i + 100));
  const { service, requests, peak } = fixture([...roots.map((root, i) => game(root, [children[i]])), ...children.map(child => game(child))]);
  const result = await service.licensedProducts(roots, 'US');
  expect(result.filter(p => p.installability === 'supported').map(p => p.productId).sort()).toEqual([...roots].sort());
  expect(requests.flat()).toHaveLength(120);
  expect(requests.every(batch => batch.length <= 25)).toBe(true);
  expect(peak()).toBeLessThanOrEqual(4);
});

it('shares fetched children without duplicating requests across licensed editions', async () => {
  const { service, requests } = fixture([game(id(1), [id(3)]), game(id(2), [id(3)]), game(id(3))]);
  expect((await service.licensedProducts([id(1), id(2)], 'US')).every(p => p.installability === 'supported')).toBe(true);
  expect(requests.flat().filter(value => value === id(3))).toHaveLength(1);
});

it('bounds each root separately and does not spend another edition’s metadata budget', async () => {
  const many = Array.from({ length: 70 }, (_, i) => id(i + 100));
  const { service, requests } = fixture([game(id(1), many), ...many.map(child => game(child)), game(id(2), [id(3)]), game(id(3))]);
  const products = await service.licensedProducts([id(1), id(2)], 'US');
  expect(products.find(p => p.productId === id(2))?.installability).toBe('supported');
  expect(new Set(requests.flat()).size).toBeLessThanOrEqual(50);
});

it('stops cyclic and over-deep bundles without fetching arbitrary licensing back-references', async () => {
  const products = Array.from({ length: 12 }, (_, i) => game(id(i), [id(i + 1)]));
  const { service, requests } = fixture(products);
  const [product] = await service.licensedProducts([id(0)], 'US');
  expect(product?.installability).not.toBe('supported');
  expect(requests.flat()).toHaveLength(7);
  const cycle = fixture([game(id(20), [id(21)]), game(id(21), [id(20)])]);
  expect((await cycle.service.licensedProducts([id(20)], 'US'))[0]?.installability).not.toBe('supported');
  expect(cycle.requests.flat()).toHaveLength(2);
});

it('does not exceed one edition’s depth using metadata cached for other licensed roots', async () => {
  const roots = Array.from({ length: 9 }, (_, i) => id(i));
  const { service, requests } = fixture(roots.map((root, i) => game(root, i + 1 < roots.length ? [roots[i + 1]] : [])));
  const result = await service.licensedProducts(roots, 'US');
  expect(result.find(p => p.productId === roots[0])?.installability).toBe('unknown');
  expect(result.find(p => p.productId === roots[2])?.installability).toBe('supported');
  expect(requests.flat()).toHaveLength(9);
});
