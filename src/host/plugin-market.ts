import { z } from 'zod';
import { marketPluginSchema } from '../core/plugin-contracts.ts';
import type { MarketPlugin } from '../core/plugin-contracts.ts';

// The same public catalog used by dsh-market; never execute its `install` shell text.
export const marketCatalogURL = 'https://awesome-dsh-plugin.com/plugins.json';
const catalogSchema = z.object({ plugins: z.array(z.unknown()).max(20000) });
const entrySchema = z.object({
  name: z.string(),
  owner: z.string(),
  url: z.url(),
  description: z.record(z.string(), z.string()),
  npm: z.string().nullish(),
  tarball: z.string().nullish(),
});
export function parseMarketCatalog(raw: unknown): MarketPlugin[] {
  return catalogSchema.parse(raw).plugins.flatMap((item) => {
    const entry = entrySchema.safeParse(item);
    if (!entry.success) return [];
    const value = entry.data;
    const parsed = marketPluginSchema.safeParse({
      name: value.name,
      owner: value.owner,
      url: value.url,
      description: value.description['zh'] ?? value.description['en'] ?? '',
      source: value.npm || value.tarball || value.url,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
export class PluginMarket {
  private cache: { at: number; entries: MarketPlugin[] } | undefined;
  async search(query: string): Promise<MarketPlugin[]> {
    if (!this.cache || Date.now() - this.cache.at > 300000) {
      const response = await fetch(marketCatalogURL, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`市场加载失败 (${String(response.status)})，请稍后重试`);
      const body = await response.text();
      if (body.length > 8000000) throw new Error('市场目录过大');
      const raw: unknown = JSON.parse(body);
      this.cache = { at: Date.now(), entries: parseMarketCatalog(raw) };
    }
    const words = query.trim().toLowerCase().split(/\s+/);
    return this.cache.entries
      .filter((entry) =>
        words.every((word) =>
          `${entry.name} ${entry.owner} ${entry.description}`.toLowerCase().includes(word),
        ),
      )
      .slice(0, 60);
  }
}
