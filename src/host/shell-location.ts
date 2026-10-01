import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function shellLocation(appPath: string, packaged: boolean, developmentUrl?: string): string {
  if (!developmentUrl) return pathToFileURL(join(appPath, 'dist/ui/index.html')).href;
  const url = new URL(developmentUrl);
  if (
    packaged ||
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'The development shell only allows an unpackaged app with a local HTTP root URL',
    );
  return url.href;
}
