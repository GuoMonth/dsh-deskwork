import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { taskSchema, messageSchema } from '../core/contracts.ts';
import type { ChatMessage, TaskState } from '../core/contracts.ts';

const savedSchema = z
  .object({ version: z.literal(1), task: taskSchema, messages: z.array(messageSchema) })
  .strict();
export class StateStore {
  private readonly directory: string;
  private queue = Promise.resolve();
  constructor(directory: string) {
    this.directory = directory;
  }
  async load(): Promise<z.infer<typeof savedSchema> | undefined> {
    try {
      return savedSchema.parse(
        JSON.parse(await readFile(join(this.directory, 'task.json'), 'utf8')),
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw new Error('任务记录无法读取，请备份后检查 task.json', { cause: error });
    }
  }
  save(task: TaskState, messages: readonly ChatMessage[]): Promise<void> {
    const content = JSON.stringify({ version: 1, task, messages });
    const write = async (): Promise<void> => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const file = join(this.directory, 'task.json');
      await writeFile(`${file}.tmp`, content, { mode: 0o600, flush: true });
      await rename(`${file}.tmp`, file);
    };
    this.queue = this.queue.then(write, write);
    return this.queue;
  }
}
