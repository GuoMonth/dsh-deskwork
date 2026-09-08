import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, symlink } from 'node:fs/promises';
import { join, dirname, delimiter } from 'node:path';
import { z } from 'zod';
import { installedPluginSchema, packageNameSchema } from '../core/plugin-contracts.ts';
import type { InstalledPlugin, PluginCommand, PluginState } from '../core/plugin-contracts.ts';

const manifestSchema = z.object({
  name: packageNameSchema,
  version: z.string(),
  dsh: z.object({ bundle: z.object({ patch: z.string().min(1) }) }),
});
const profileSchema = z.object({ dependencies: z.record(z.string(), z.string()).default({}) });
const registrySchema = z
  .object({ version: z.literal(1), installed: z.array(installedPluginSchema) })
  .strict()
  .refine(
    ({ installed }) =>
      new Set(installed.map((entry) => entry.name)).size === installed.length &&
      new Set(installed.map((entry) => entry.mountName)).size === installed.length,
    '插件或挂载名重复',
  );
export interface PluginManagerOptions {
  directory: string;
  executable: string;
  cliPath: string;
  pnpmPath: string;
  onProgress?: () => void;
  validate?: (home: string, plugin: InstalledPlugin) => Promise<void>;
}
export class PluginManager {
  private installed: InstalledPlugin[] = [];
  private busy = false;
  private closed = false;
  private child: ChildProcess | undefined;
  private progress = '';
  private readonly options: PluginManagerOptions;
  constructor(options: PluginManagerOptions) {
    this.options = options;
  }
  async load(): Promise<void> {
    await mkdir(this.options.directory, { recursive: true, mode: 0o700 });
    try {
      const raw: unknown = JSON.parse(await readFile(this.registryPath(), 'utf8'));
      this.installed = registrySchema.parse(raw).installed;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  state(): PluginState {
    return { installed: structuredClone(this.installed), busy: this.busy, progress: this.progress };
  }
  private registryPath(): string {
    return join(this.options.directory, 'installed.json');
  }
  private installationHome(id: string): string {
    return join(this.options.directory, 'installations', id);
  }
  private modules(plugin: InstalledPlugin): string {
    return join(
      this.installationHome(plugin.installationId),
      'profiles',
      'sdk-minimal',
      'node_modules',
    );
  }
  private async save(installed: InstalledPlugin[]): Promise<void> {
    if (this.closed) throw new Error('插件管理已关闭');
    const data = registrySchema.parse({ version: 1, installed });
    const path = this.registryPath();
    await writeFile(path + '.next', JSON.stringify(data), { mode: 0o600, flush: true });
    await rename(path + '.next', path);
    this.installed = data.installed;
  }
  private notify(text: string): void {
    this.progress = text;
    this.options.onProgress?.();
  }
  async command(command: PluginCommand): Promise<void> {
    if (this.busy || this.closed) throw new Error('插件变更正在进行或客户端已关闭');
    this.busy = true;
    try {
      if (command.action === 'install') await this.install(command.source);
      else {
        const current = this.installed.find((entry) => entry.name === command.name);
        if (!current) throw new Error('插件未安装');
        if (command.action === 'update') await this.install(current.source, current);
        else if (command.action === 'remove') {
          await this.save(this.installed.filter((entry) => entry !== current));
          // A removal failure must not resurrect an enabled plugin. Its orphaned files can be cleaned later.
          await rm(this.installationHome(current.installationId), { recursive: true, force: true });
          this.notify('插件已卸载');
        } else {
          if (
            this.installed.some(
              (entry) => entry !== current && entry.mountName === command.mountName,
            )
          )
            throw new Error('挂载名已被使用');
          await this.save(
            this.installed.map((entry) =>
              entry === current
                ? {
                    ...current,
                    mountName: command.mountName,
                    enabled: command.enabled,
                    siteIds: [...new Set(command.siteIds)],
                  }
                : entry,
            ),
          );
          this.notify('插件设置已保存，下次任务使用新设置');
        }
      }
    } catch (error) {
      this.notify(error instanceof Error ? error.message : '插件操作失败');
      throw error;
    } finally {
      this.busy = false;
      this.options.onProgress?.();
    }
  }
  // Also used by local integration fixtures; renderer commands validate public installation sources.
  async install(source: string, previous?: InstalledPlugin): Promise<void> {
    const installationId = randomUUID();
    const home = this.installationHome(installationId);
    const profile = join(home, 'profiles', 'sdk-minimal');
    try {
      await mkdir(profile, { recursive: true });
      await writeFile(
        join(profile, 'package.json'),
        JSON.stringify({
          name: 'deskwork-plugins',
          private: true,
          dependencies: {},
          dsh: { profile: { bundles: ['@deepseek-ai/dsh-sdk-minimal'], patchReload: 'startup' } },
        }),
      );
      await writeFile(join(profile, 'cordis.patch.yml'), '[]\n');
      await writeFile(
        join(profile, 'pnpm-workspace.yaml'),
        'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\ndangerouslyAllowAllBuilds: true\n',
      );
      const bin = join(home, 'bin');
      await mkdir(bin, { recursive: true });
      await symlink(this.options.executable, join(bin, 'node'));
      const quote = (text: string): string => "'" + text.replaceAll("'", "'\\''") + "'";
      await writeFile(
        join(bin, 'pnpm'),
        `#!/bin/sh\nexec ${quote(this.options.executable)} ${quote(this.options.pnpmPath)} "$@"\n`,
        { mode: 0o700 },
      );
      this.notify(`正在安装 ${source}`);
      await this.run(
        [this.options.cliPath, 'plugin', '--profile', 'sdk-minimal', 'add', '--save-exact', source],
        home,
        bin,
      );
      const raw: unknown = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
      const names = Object.keys(profileSchema.parse(raw).dependencies);
      if (names.length !== 1 || !names[0]) throw new Error('安装结果没有唯一的插件包');
      const name = packageNameSchema.parse(names[0]);
      const manifestRaw: unknown = JSON.parse(
        await readFile(join(profile, 'node_modules', name, 'package.json'), 'utf8'),
      );
      const manifest = manifestSchema.parse(manifestRaw);
      if (previous && name !== previous.name) throw new Error('升级源返回了不同插件');
      if (!previous && this.installed.some((entry) => entry.name === name))
        throw new Error('插件已安装，请使用更新');
      // DSH itself composes the patch; this catches malformed bundles before replacing the working install.
      await this.run(
        [this.options.cliPath, '--profile', 'sdk-minimal', '--dump-config'],
        home,
        bin,
      );
      const baseName = name
        .replace(/^@/, '')
        .replaceAll(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 65);
      let mountName = previous?.mountName ?? baseName;
      let suffix = 1;
      while (!previous && this.installed.some((entry) => entry.mountName === mountName))
        mountName = `${baseName}-${String(suffix++)}`;
      const plugin: InstalledPlugin = {
        name,
        version: manifest.version,
        source,
        installationId,
        mountName,
        enabled: previous?.enabled ?? true,
        siteIds: previous?.siteIds ?? [],
      };
      await this.options.validate?.(home, plugin);
      await this.save([...this.installed.filter((entry) => entry.name !== name), plugin]);
      this.notify(`已安装 ${name} ${manifest.version}`);
    } catch (error) {
      await rm(home, { recursive: true, force: true });
      throw error;
    }
  }
  private async run(args: string[], home: string, bin: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let output = '';
      const child = spawn(this.options.executable, args, {
        cwd: home,
        env: {
          PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`,
          HOME: process.env['HOME'],
          TMPDIR: process.env['TMPDIR'],
          ELECTRON_RUN_AS_NODE: '1',
          DSH_HOME: home,
          CI: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
      const collect = (chunk: Buffer): void => {
        output = (output + chunk.toString()).slice(-5000);
      };
      this.child = child;
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
      const timer = setTimeout(() => {
        this.killChild(child);
      }, 180000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        if (this.child === child) this.child = undefined;
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`插件安装或加载失败 (${String(code)})\n${output}`));
      });
    });
  }
  async prepareRuntime(dataDirectory: string, siteId: string): Promise<InstalledPlugin[]> {
    if (this.busy) throw new Error('请等待插件变更完成');
    const selected = this.installed.filter(
      (entry) => entry.enabled && (!entry.siteIds.length || entry.siteIds.includes(siteId)),
    );
    const profile = join(dataDirectory, 'profiles', 'sdk-minimal');
    await mkdir(profile, { recursive: true });
    // Runtime is stopped before replacing this projection. Original installations remain immutable.
    await rm(join(profile, 'node_modules'), { recursive: true, force: true });
    await mkdir(join(profile, 'node_modules'), { recursive: true });
    for (const plugin of selected) {
      const link = join(profile, 'node_modules', plugin.name);
      await mkdir(dirname(link), { recursive: true });
      await symlink(join(this.modules(plugin), plugin.name), link, 'dir');
    }
    await writeFile(
      join(profile, 'package.json'),
      JSON.stringify({
        name: 'deskwork-runtime-profile',
        private: true,
        dependencies: {},
        dsh: {
          profile: {
            bundles: ['@deepseek-ai/dsh-sdk-minimal', ...selected.map((entry) => entry.name)],
            patchReload: 'startup',
          },
        },
      }),
    );
    await writeFile(join(profile, 'cordis.patch.yml'), '[]\n');
    return selected;
  }
  private killChild(child: ChildProcess): void {
    if (!child.pid || child.exitCode !== null) return;
    try {
      if (process.platform === 'win32') child.kill('SIGKILL');
      else process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
    }
  }
  async close(): Promise<void> {
    this.closed = true;
    const child = this.child;
    if (!child || child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      child.once('close', () => {
        resolve();
      });
      this.killChild(child);
    });
  }
}
