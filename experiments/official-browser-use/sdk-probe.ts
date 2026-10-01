import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { z } from 'zod';

const messageSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).loose().optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
});

/** A disposable SDK client; it never changes the production runtime adapter. */
export class SdkProbe {
  readonly events: unknown[] = [];
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private sequence = 0;
  private diagnostics = '';
  private sawRunning = false;
  private idle: (() => void) | undefined;

  constructor(executable: string, cli: string, patch: string, directory: string) {
    this.child = spawn(
      executable,
      ['--expose-internals', cli, '--profile', 'sdk-minimal', '--patch', patch],
      {
        cwd: directory,
        env: {
          PATH: process.env['PATH'],
          HOME: process.env['HOME'],
          LANG: process.env['LANG'],
          ELECTRON_RUN_AS_NODE: '1',
          DSH_HOME: directory,
          DEEPSEEK_API_KEY: 'fixture-key-not-a-secret',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => {
      this.diagnostics = (this.diagnostics + chunk).slice(-10000);
    });
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', (line) => {
      const parsed = messageSchema.safeParse(JSON.parse(line));
      if (!parsed.success) return;
      const message = parsed.data;
      this.events.push(message);
      if (message.id !== undefined) {
        const pending = this.pending.get(String(message.id));
        this.pending.delete(String(message.id));
        if (message.error) pending?.reject(new Error(message.error.message));
        else pending?.resolve(message.result);
      } else if (message.method === 'session.status') {
        const status = z.object({ status: z.string() }).parse(message.params).status;
        if (status === 'running') this.sawRunning = true;
        if (status === 'idle' && this.sawRunning) this.idle?.();
      }
    });
    this.child.once('close', () => {
      lines.close();
      for (const pending of this.pending.values())
        pending.reject(new Error(`SDK exited: ${this.diagnostics}`));
      this.pending.clear();
    });
  }

  async request(method: string, params: unknown): Promise<unknown> {
    const id = String(++this.sequence);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<unknown>((resolve, reject: (error: Error) => void) => {
        timer = setTimeout(() => {
          reject(new Error(`${method} timed out: ${this.diagnostics}`));
        }, 20000);
        this.pending.set(id, { resolve, reject });
        this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    } finally {
      clearTimeout(timer);
      this.pending.delete(id);
    }
  }

  async prompt(text: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const completed = new Promise<void>((resolve, reject: (error: Error) => void) => {
      this.idle = resolve;
      timer = setTimeout(() => {
        reject(new Error(`Prompt timed out: ${this.diagnostics}`));
      }, 30000);
    });
    try {
      await this.request('session/prompt', {
        sessionId: 'official-browser-research',
        contentBlocks: [{ type: 'text', text }],
      });
      await completed;
    } finally {
      clearTimeout(timer);
      this.idle = undefined;
    }
  }

  async close(): Promise<void> {
    if (this.child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      const deadline = setTimeout(() => this.child.kill('SIGKILL'), 2000);
      this.child.once('close', () => {
        clearTimeout(deadline);
        resolve();
      });
      this.child.kill('SIGTERM');
    });
  }

  diagnosticText(): string {
    return this.diagnostics;
  }
}
