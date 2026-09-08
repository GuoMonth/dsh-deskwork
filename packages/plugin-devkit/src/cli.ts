#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDocumentationServer } from './server.ts';
import { createPlugin } from './scaffold.ts';

const [command, directory, sdkFlag, archive, ...extra] = process.argv.slice(2);
if (command === 'mcp' && !directory) {
  await createDocumentationServer().connect(new StdioServerTransport());
} else if (
  command === 'create' &&
  directory &&
  sdkFlag === '--sdk' &&
  archive &&
  extra.length === 0
) {
  await createPlugin(directory, archive);
  console.log(`Created ${directory}. Run npm install and npm run check in that directory.`);
} else {
  console.error(
    'Usage: deskwork-devkit mcp | deskwork-devkit create <new-directory> --sdk <sdk.tgz>',
  );
  process.exitCode = 1;
}
