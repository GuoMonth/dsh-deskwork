import { writeFileSync } from 'node:fs';
writeFileSync(
  new URL('../installation-runtime.json', import.meta.url),
  JSON.stringify({
    executable: process.execPath,
    node: process.versions.node,
    electron: process.versions.electron,
  }),
);
