import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { contextSchema, defaultWorkspace, workspaceSchema } from '../core/contracts.ts';
import type { EntryContext, Workspace } from '../core/contracts.ts';
const savedSchema = z.object({ version: z.literal(2), contexts: z.array(contextSchema) }).strict();
function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
export class StateStore {
  private readonly directory: string;
  private queue = Promise.resolve();
  constructor(directory: string) {
    this.directory = directory;
  }
  private async read(name: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(join(this.directory, name), 'utf8')) as unknown;
    } catch (error) {
      if (missing(error)) return undefined;
      throw error;
    }
  }
  private async archive(name: string): Promise<void> {
    const archiveDirectory = join(this.directory, 'archive');
    await mkdir(archiveDirectory, { recursive: true, mode: 0o700 });
    try {
      await copyFile(
        join(this.directory, name),
        join(archiveDirectory, `${String(Date.now())}-${name}`),
      );
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  async loadWorkspace(): Promise<Workspace> {
    const raw = await this.read('workspace.json');
    if (raw === undefined) return structuredClone(defaultWorkspace);
    const version = z.object({ version: z.number() }).parse(raw).version;
    if (version === 2) return workspaceSchema.parse(raw);
    if (version !== 1) throw new Error('配置版本不受支持，请保留原文件');
    const old = z
      .object({
        version: z.literal(1),
        name: z.string(),
        sites: z.array(
          z
            .object({ id: z.string(), name: z.string(), url: z.string(), sessionId: z.string() })
            .loose(),
        ),
      })
      .parse(raw);
    const workspace = workspaceSchema.parse({
      version: 2,
      name: old.name,
      sites: old.sites.map(({ id, name, url, sessionId }) => ({ id, name, url, sessionId })),
    });
    await this.archive('workspace.json');
    await this.saveWorkspace(workspace);
    return workspace;
  }
  async load(): Promise<EntryContext[]> {
    const raw = await this.read('task.json');
    // Legacy artifacts never enter the new execution state, even when there was no workspace file.
    for (const name of ['skills.json', 'record-profiles.json']) {
      let exists = false;
      try {
        await readFile(join(this.directory, name));
        exists = true;
      } catch (error) {
        if (!missing(error)) throw error;
      }
      if (exists) {
        await this.archive(name);
        await rename(
          join(this.directory, name),
          join(this.directory, 'archive', `retired-${name}`),
        );
      }
    }
    if (raw === undefined) return [];
    if (
      z
        .object({ version: z.literal(1) })
        .loose()
        .safeParse(raw).success
    ) {
      await this.archive('task.json');
      await this.save([]);
      return [];
    }
    return savedSchema.parse(raw).contexts;
  }
  saveWorkspace(workspace: Workspace): Promise<void> {
    return this.write('workspace.json', workspaceSchema.parse(workspace));
  }
  save(contexts: readonly EntryContext[]): Promise<void> {
    return this.write('task.json', savedSchema.parse({ version: 2, contexts }));
  }
  archiveContext(context: EntryContext): Promise<void> {
    return this.write(`archive/${context.siteId}-${String(Date.now())}.json`, context);
  }
  private write(name: string, value: unknown): Promise<void> {
    const content = JSON.stringify(value);
    const write = async (): Promise<void> => {
      await mkdir(join(this.directory, 'archive'), { recursive: true, mode: 0o700 });
      const file = join(this.directory, name);
      await writeFile(`${file}.tmp`, content, { mode: 0o600, flush: true });
      await rename(`${file}.tmp`, file);
    };
    this.queue = this.queue.then(write, write);
    return this.queue;
  }
}
