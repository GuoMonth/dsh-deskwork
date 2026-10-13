import './build-devkit.ts';
import './build-plugins.ts';
import { build as bundle } from 'esbuild';
import { build as buildUi } from 'vite';
import { desktopBuildOptions } from './desktop-build-options.ts';
import './generate-tokens.ts';
import { cp, rm } from 'node:fs/promises';
import { generateBrandAssets } from './brand-assets.ts';

await generateBrandAssets();
await Promise.all([...desktopBuildOptions.map((options) => bundle(options)), buildUi()]);
await rm('dist/brand', { recursive: true, force: true });
await cp('packaging/brand', 'dist/brand', { recursive: true });
console.log('Desktop, preload, tool bridge and UI built.');
