import './build-devkit.ts';
import './build-plugins.ts';
import { build as bundle } from 'esbuild';
import { build as buildUi } from 'vite';
import { desktopBuildOptions } from './desktop-build-options.ts';
import './generate-tokens.ts';
await Promise.all([...desktopBuildOptions.map((options) => bundle(options)), buildUi()]);
console.log('Desktop, preload, tool bridge and UI built.');
