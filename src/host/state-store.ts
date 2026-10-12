import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { contextSchema, defaultWorkspace, siteSchema, workspaceSchema } from '../core/contracts.ts';
import {
  defaultLanguagePreference,
  languagePreferenceSchema,
  localeSchema,
  resolveLocale,
} from '../core/locale.ts';
import type { EntryContext, Workspace } from '../core/contracts.ts';
const savedSchema = z.object({ version: z.literal(2), contexts: z.array(contextSchema) }).strict();
const legacyWorkspaceSchema = z
  .object({
    version: z.literal(2),
    locale: z.unknown().optional(),
    languagePreference: z.unknown().optional(),
    name: z.string(),
    sites: z.array(siteSchema).max(24),
  })
  .strict();
function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
function hasOwn(value: unknown, key: string): boolean {
  return typeof value === 'object' && value !== null && Object.hasOwn(value, key);
}
export class StateStore {
  private readonly directory: string;
  private readonly preferredSystemLanguages: readonly string[];
  private queue = Promise.resolve();
  constructor(directory: string, preferredSystemLanguages: readonly string[] = []) {
    this.directory = directory;
    this.preferredSystemLanguages = [...preferredSystemLanguages];
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
  async loadWorkspace(
    preferredSystemLanguages: readonly string[] = this.preferredSystemLanguages,
  ): Promise<Workspace> {
    const raw = await this.read('workspace.json');
    if (raw === undefined)
      return workspaceSchema.parse({
        ...structuredClone(defaultWorkspace),
        locale: resolveLocale(defaultLanguagePreference, preferredSystemLanguages),
      });
    const version = z.object({ version: z.number() }).parse(raw).version;
    if (version === 2) {
      const legacy = legacyWorkspaceSchema.parse(raw);
      const rawHasPreference = hasOwn(raw, 'languagePreference');
      const rawHasLocale = hasOwn(raw, 'locale');
      const parsedPreference = rawHasPreference
        ? languagePreferenceSchema.safeParse(legacy.languagePreference)
        : undefined;
      const parsedLocale = rawHasLocale ? localeSchema.safeParse(legacy.locale) : undefined;
      // Before languagePreference existed, a known locale was the only safe signal of a manual
      // choice. Unknown values are discarded and return to the supported system default.
      const preference = parsedPreference?.success
        ? parsedPreference.data
        : !rawHasPreference && parsedLocale?.success
          ? parsedLocale.data
          : defaultLanguagePreference;
      const locale =
        !rawHasPreference && parsedLocale?.success
          ? parsedLocale.data
          : resolveLocale(preference, preferredSystemLanguages);
      const workspace = workspaceSchema.parse({
        version: 2,
        name: legacy.name,
        sites: legacy.sites,
        languagePreference: preference,
        locale,
      });
      const needsMigration =
        !rawHasPreference ||
        !rawHasLocale ||
        !parsedPreference?.success ||
        !parsedLocale?.success ||
        legacy.locale !== locale;
      if (needsMigration) {
        await this.archive('workspace.json');
        await this.saveWorkspace(workspace);
      }
      return workspace;
    }
    if (version !== 1)
      throw new Error('Unsupported configuration version. Keep the original file.');
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
      languagePreference: defaultLanguagePreference,
      locale: resolveLocale(defaultLanguagePreference, preferredSystemLanguages),
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
