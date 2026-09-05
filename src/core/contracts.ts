import { z } from 'zod';

const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const siteSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(100),
    url: z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
    sessionId: identifier,
    profileId: identifier.default('unconfigured'),
  })
  .strict();
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(100),
    sites: z.array(siteSchema).min(1).max(12),
  })
  .strict()
  .refine(
    (value) => new Set(value.sites.map((site) => site.id)).size === value.sites.length,
    'Tab IDs must be unique',
  );
export type Workspace = z.infer<typeof workspaceSchema>;
export type Site = z.infer<typeof siteSchema>;
export const defaultWorkspace: Workspace = {
  version: 1,
  name: '我的业务工作区',
  sites: [
    {
      id: 'senguo',
      name: '森果 · 档口批发',
      url: 'https://center.senguo.cc/#/main/shopList',
      sessionId: 'senguo',
      profileId: 'unconfigured',
    },
  ],
};

export const targetSchema = z
  .object({ tabId: identifier, sessionId: identifier, profileId: identifier })
  .strict();
export type TaskTarget = z.infer<typeof targetSchema>;
export const recordSchema = z
  .object({
    shopId: z.string().min(1),
    objectId: z.string().min(1),
    name: z.string(),
    field: z.string().min(1),
    value: z.string(),
    pageRevision: z.string().min(1),
  })
  .strict();
export type BusinessRecord = z.infer<typeof recordSchema>;
export interface RecordBrowser {
  read(target: TaskTarget, objectId: string, source?: 'page' | 'server'): Promise<BusinessRecord>;
  write(target: TaskTarget, expected: BusinessRecord, value: string): Promise<void>;
}
export const confirmationSchema = z
  .object({ id: z.string(), record: recordSchema, nextValue: z.string().max(2000) })
  .strict();
export const taskStatusSchema = z.enum([
  'idle',
  'running',
  'waiting-user',
  'paused',
  'verifying',
  'succeeded',
  'failed',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export const taskSchema = z
  .object({
    id: z.string(),
    status: taskStatusSchema,
    target: targetSchema.nullable(),
    title: z.string(),
    detail: z.string(),
    confirmation: confirmationSchema.nullable(),
    result: recordSchema.nullable(),
    writeVerified: z.boolean().default(false),
    steps: z.array(z.object({ id: z.string(), text: z.string() }).strict()),
    metrics: z
      .object({
        modelCalls: z.number(),
        toolCalls: z.number(),
        startedAt: z.number(),
        elapsedMs: z.number(),
        skillReused: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type TaskState = z.infer<typeof taskSchema>;
export function idleTask(): TaskState {
  return {
    id: '',
    status: 'idle',
    target: null,
    title: '',
    detail: '准备好开始今天的工作',
    confirmation: null,
    result: null,
    writeVerified: false,
    steps: [],
    metrics: { modelCalls: 0, toolCalls: 0, startedAt: 0, elapsedMs: 0, skillReused: false },
  };
}
export const messageSchema = z
  .object({ id: z.string(), role: z.enum(['user', 'assistant']), text: z.string() })
  .strict();
export type ChatMessage = z.infer<typeof messageSchema>;
export const snapshotSchema = z
  .object({
    workspace: workspaceSchema,
    task: taskSchema,
    messages: z.array(messageSchema),
    runtimeConfigured: z.boolean(),
    preview: z.boolean(),
  })
  .strict();
export type WorkspaceSnapshot = z.infer<typeof snapshotSchema>;
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('send'),
      text: z.string().trim().min(1).max(12000),
      tabId: identifier,
    })
    .strict(),
  z.object({ type: z.literal('confirm'), confirmationId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('stop') }).strict(),
  z.object({ type: z.literal('resume') }).strict(),
  z.object({ type: z.literal('new-task') }).strict(),
  z
    .object({
      type: z.literal('settings'),
      apiKey: z.string().min(1).max(1000),
      model: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal('layout'),
      tabId: identifier,
      visible: z.boolean(),
      bounds: z
        .object({
          x: z.number().int().nonnegative(),
          y: z.number().int().nonnegative(),
          width: z.number().int().nonnegative(),
          height: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('reload'), tabId: identifier }).strict(),
]);
export type WorkspaceCommand = z.infer<typeof commandSchema>;
export interface DeskworkBridge {
  snapshot(): Promise<WorkspaceSnapshot>;
  command(command: WorkspaceCommand): Promise<void>;
  subscribe(listener: (snapshot: WorkspaceSnapshot) => void): () => void;
}
