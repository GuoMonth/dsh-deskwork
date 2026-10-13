import { stageBrandAssets } from './brand-assets.ts';

const files = await stageBrandAssets();
console.log(
  `Staged ${String(files.length)} brand assets in dist/brand from packaging/brand/mark.svg.`,
);
