import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

export async function createPlugin(directory: string, sdkArchive: string): Promise<void> {
  const destination = path.resolve(directory);
  const name = z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,79}$/)
    .parse(path.basename(destination));
  const sdkPath = path.resolve(sdkArchive);
  if (!(await stat(sdkPath)).isFile() || !sdkPath.endsWith('.tgz'))
    throw new Error('Provide the built SDK .tgz archive');
  // Exclusive creation protects existing projects; only our newly created folder can be cleaned up.
  await mkdir(destination);
  try {
    await cp(fileURLToPath(new URL('../templates/plugin/', import.meta.url)), destination, {
      recursive: true,
    });
    const packagePath = path.join(destination, 'package.json');
    const manifest = (await readFile(path.join(destination, 'package.json.txt'), 'utf8'))
      .replaceAll('deskwork-example-plugin', name)
      .replace('SDK_ARCHIVE', pathToFileURL(sdkPath).href);
    await writeFile(packagePath, manifest);
    await rm(path.join(destination, 'package.json.txt'));
    for (const file of ['index.ts', 'tsconfig.json'])
      await rename(path.join(destination, `${file}.txt`), path.join(destination, file));
    for (const file of ['index.ts', 'cordis.patch.yml']) {
      const filename = path.join(destination, file);
      await writeFile(
        filename,
        (await readFile(filename, 'utf8')).replaceAll('deskwork-example-plugin', name),
      );
    }
  } catch (error: unknown) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}
