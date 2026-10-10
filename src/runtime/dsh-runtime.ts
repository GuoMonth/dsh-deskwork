import { assistantInstructions } from './assistant-instructions.ts';
import type { Locale } from '../core/locale.ts';
import { desktopEnvironment, nodeEnvironment } from './node-environment.ts';
import type { InstalledPlugin } from '../core/plugin-contracts.ts';
import { pluginLoadSchema } from '../core/plugin-contracts.ts';
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';
import { z } from 'zod';
export interface RuntimeOptions {
  executable: string;
  cliPath: string;
  mcpPath: string;
  dataDirectory: string;
  apiKey: string;
  model: string;
  toolEndpoint: string;
  toolToken: string;
  baseURL?: string;
  locale?: Locale;
  plugins?: readonly InstalledPlugin[];
  site?: { id: string; name: string; url: string };
  resumeSession?: boolean;
  onNotification: (method: string, params: unknown) => void;
}

export class DshRuntime {
  private child: ChildProcessWithoutNullStreams | undefined;
  private transport: JsonRpcLineTransport | undefined;
  private stderr = '';
  private closed = false;
  private readonly options: RuntimeOptions;
  constructor(options: RuntimeOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    this.assertOpen();
    if (this.child) return;
    const options = this.options;
    if (options.baseURL !== undefined) {
      let url: URL;
      try {
        url = new URL(options.baseURL);
      } catch {
        throw new Error('Invalid model URL: use the HTTP(S) root URL of the Messages API.');
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        /\/(?:messages|chat\/completions)\/?$/.test(url.pathname)
      )
        throw new Error(
          'Invalid model URL: use the Messages API root URL without credentials, query parameters or a request path.',
        );
    }
    await mkdir(options.dataDirectory, { recursive: true, mode: 0o700 });
    const patchPath = join(options.dataDirectory, 'deskwork.patch.json');
    const patch: unknown[] = [
      ...[
        'persistent-bash',
        'persistent-pwsh',
        'str-replace-editor',
        'terminal-bash',
        'terminal-pwsh',
        'pty',
      ].map((id) => ({ id, disabled: true })),
      {
        id: 'llm-deepseek',
        config: {
          apiKeyEnv: 'DEEPSEEK_API_KEY',
          ...(options.baseURL ? { baseURL: options.baseURL } : {}),
          thinking: 'disabled',
          maxTokens: 8192,
          streamIdleTimeoutMs: 60000,
        },
      },
      { id: 'sdk-jsonrpc-server', disabled: true },
      {
        insert: [
          {
            id: 'deskwork-sdk-server',
            name: join(dirname(options.mcpPath), 'sdk-server.mjs'),
            inject: ['sdkAppStartup', 'loader'],
          },
          {
            id: 'deskwork-mcp',
            name: join(dirname(options.cliPath), '../../dsh-mcp-client/lib/index.js'),
            config: {
              transport: 'stdio',
              serverName: 'deskwork',
              command: options.executable,
              args: [options.mcpPath],
              cwd: options.dataDirectory,
              env: {
                ELECTRON_RUN_AS_NODE: '1',
                DESKWORK_TOOL_ENDPOINT: options.toolEndpoint,
                DESKWORK_TOOL_TOKEN: options.toolToken,
              },
              failOnStartupError: true,
              toolCallTimeoutMs: 20000,
            },
          },
        ],
      },
    ];
    patch.push({
      insert: [
        {
          id: 'deskwork-native-services',
          name: join(dirname(options.mcpPath), 'native-services.mjs'),
          config: { skillDirectory: join(options.dataDirectory, 'skills') },
        },
        {
          id: 'deskwork-approval-answerer',
          name: join(dirname(options.mcpPath), 'user-approval.mjs'),
        },
        {
          id: 'deskwork-browser-service',
          name: join(dirname(options.mcpPath), 'browser-service.mjs'),
        },
        {
          id: 'deskwork-development-guide',
          name: join(dirname(options.mcpPath), 'devkit/lib/plugin.js'),
          inject: ['skills', 'tools'],
        },
        {
          id: 'deskwork-skills',
          name: join(dirname(options.cliPath), '../../dsh-skill/lib/index.js'),
        },
        {
          id: 'deskwork-skill-tool',
          name: join(dirname(options.cliPath), '../../dsh-tool-skill/lib/index.js'),
        },
      ],
    });
    await writeFile(patchPath, JSON.stringify(patch), { mode: 0o600 });
    const environment = await desktopEnvironment();
    this.assertOpen();
    // Cordis resolves out-of-tree plugins through Node internals; Electron needs the explicit flag.
    const child = spawn(
      options.executable,
      ['--expose-internals', options.cliPath, '--profile', 'sdk-minimal', '--patch', patchPath],
      {
        cwd: options.dataDirectory,
        env: nodeEnvironment({
          ...environment,
          DSH_HOME: options.dataDirectory,
          DEEPSEEK_API_KEY: options.apiKey,
          DESKWORK_TOOL_ENDPOINT: options.toolEndpoint,
          DESKWORK_TOOL_TOKEN: options.toolToken,
          DESKWORK_PLUGINS: JSON.stringify(options.plugins ?? []),
          DESKWORK_HOST: '1',
          DESKWORK_SITE_CONTEXT: JSON.stringify(options.site ?? null),
          DESKWORK_DATA_DIRECTORY: options.dataDirectory,
          DSH_SYSTEM_PROMPT: assistantInstructions(options.locale ?? 'en'),
        }),
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    this.child = child;
    this.stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-6000);
    });
    const transport = new JsonRpcLineTransport(child.stdout, child.stdin);
    this.transport = transport;
    transport.onNotification(options.onNotification);
    transport.start();
    child.on('error', () => {
      transport.close();
    });
    child.on('close', (code) => {
      transport.close();
      if (this.child === child) this.child = undefined;
      if (!this.closed) options.onNotification('deskwork.exit', { code });
    });
    try {
      const initialized = await this.request('initialize', {
        cwd: options.dataDirectory,
        provider: 'deepseek-official',
        model: options.model,
        maxTokens: 8192,
      });
      z.object({
        serverInfo: z.object({
          name: z.literal('deepseek-harness-sdk-runtime'),
          version: z.string(),
        }),
      }).parse(initialized);
      const status = z.array(pluginLoadSchema).parse(
        await this.request('deskwork/plugins/status', {
          names: (options.plugins ?? []).map((plugin) => plugin.name),
        }),
      );
      options.onNotification('deskwork.plugins', status);
    } catch (error) {
      await this.close();
      const detail = this.stderr
        .replaceAll(options.apiKey, '[redacted]')
        .replaceAll(options.toolToken, '[redacted]');
      throw new Error(
        `DSH startup failed: ${error instanceof Error ? error.message : 'Handshake failed'}\n${detail}`,
        { cause: error },
      );
    }
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    await this.start();
    const receipt = await this.request('deskwork/session/prompt', {
      sessionId,
      text,
      mustResume: this.options.resumeSession ?? false,
    });
    z.object({ messageId: z.string() }).parse(receipt);
  }

  async close(): Promise<void> {
    this.closed = true;
    const child = this.child;
    if (!child) return;
    if (child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
      }, 2500);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      // Native teardown drains its append-only log before releasing session ownership.
      void this.request('shutdown', {}, 1500).catch(() => {
        child.kill('SIGTERM');
      });
    });
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('DSH runtime closed');
  }

  private request(method: string, params: object, timeout = 15000): Promise<unknown> {
    if (!this.transport) return Promise.reject(new Error('DSH not started'));
    return this.transport.request(method, params, AbortSignal.timeout(timeout));
  }
}
