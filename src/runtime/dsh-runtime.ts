import { assistantInstructions } from './assistant-instructions.ts';
import type { Locale } from '../core/locale.ts';
import { nodeEnvironment } from './node-environment.ts';
import type { InstalledPlugin } from '../core/plugin-contracts.ts';
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const rpcSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).loose().optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
});
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
  recoveryContext?: readonly { role: 'user' | 'assistant'; text: string }[];
  onNotification: (method: string, params: unknown) => void;
}
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DshRuntime {
  private child: ChildProcessWithoutNullStreams | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private sequence = 0;
  private stderr = '';
  private closed = false;
  private readonly wireSessions = new Map<string, string>();
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
    if (options.plugins?.some((plugin) => plugin.name === '@guosheng_047/dsh-erp')) {
      patch.push({
        id: 'erp',
        inject: ['tools', 'llm', 'agents', 'systemPrompt', 'browserUse', 'deskworkBrowser'],
        config: {
          browserMode: 'native',
          ...(options.site
            ? {
                system: {
                  url: options.site.url,
                  baseUrl: new URL('.', options.site.url).href,
                  name: options.site.name,
                  account: options.site.id,
                },
              }
            : {}),
          dataDir: join(options.dataDirectory, 'erp'),
        },
      });
    }
    await writeFile(patchPath, JSON.stringify(patch), { mode: 0o600 });
    this.assertOpen();
    // Cordis resolves out-of-tree plugins through Node internals; Electron needs the explicit flag.
    const child = spawn(
      options.executable,
      ['--expose-internals', options.cliPath, '--profile', 'sdk-minimal', '--patch', patchPath],
      {
        cwd: options.dataDirectory,
        env: nodeEnvironment({
          PATH: process.env['PATH'],
          HOME: process.env['HOME'],
          TMPDIR: process.env['TMPDIR'],
          LANG: process.env['LANG'],
          DSH_HOME: options.dataDirectory,
          DEEPSEEK_API_KEY: options.apiKey,
          DESKWORK_TOOL_ENDPOINT: options.toolEndpoint,
          DESKWORK_TOOL_TOKEN: options.toolToken,
          DESKWORK_PLUGINS: JSON.stringify(options.plugins ?? []),
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
    child.on('error', (error) => {
      this.rejectPending(error);
    });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        const message = rpcSchema.parse(JSON.parse(line));
        if (message.id !== undefined) {
          const pending = this.pending.get(String(message.id));
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(String(message.id));
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        } else if (message.method) {
          const scoped = z.object({ sessionId: z.string() }).loose().safeParse(message.params);
          if (scoped.success) {
            const logicalId = [...this.wireSessions].find(
              ([, wire]) => wire === scoped.data.sessionId,
            )?.[0];
            if (logicalId)
              options.onNotification(message.method, { ...scoped.data, sessionId: logicalId });
          } else options.onNotification(message.method, message.params);
        }
      } catch {
        this.rejectPending(new Error('DSH returned incompatible protocol data'));
      }
    });
    child.on('close', (code) => {
      lines.close();
      if (this.child === child) this.child = undefined;
      this.rejectPending(new Error(`DSH exited (${String(code)})`));
      options.onNotification('deskwork.exit', { code });
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
    let wireId = this.wireSessions.get(sessionId);
    const fresh = !wireId;
    if (!wireId) {
      wireId = randomUUID();
      this.wireSessions.set(sessionId, wireId);
    }
    const context = fresh
      ? this.options.recoveryContext
          ?.slice(-12)
          .map((message) => ({ ...message, text: message.text.slice(0, 6000) }))
      : undefined;
    const prompt = context?.length
      ? `The following saved Deskwork context may be stale. Observe again and verify the current business state; previous confirmations cannot be reused.\n${JSON.stringify(context)}\n\nCurrent request:\n${text}`
      : text;
    const receipt = await this.request('session/prompt', {
      sessionId: wireId,
      contentBlocks: [{ type: 'text', text: prompt }],
    });
    z.object({ messageId: z.string() }).parse(receipt);
  }

  async close(): Promise<void> {
    this.closed = true;
    const child = this.child;
    if (!child) return;
    this.rejectPending(new Error('Task stopped'));
    if (child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
      }, 1500);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      child.stdin.end();
      child.kill('SIGTERM');
    });
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('DSH runtime closed');
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const child = this.child;
    if (!child) return Promise.reject(new Error('DSH not started'));
    const id = String(++this.sequence);
    return new Promise((resolve, reject: (error: Error) => void) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DSH ${method} timed out`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }
  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
