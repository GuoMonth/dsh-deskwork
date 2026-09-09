import {
  identifier,
  websiteUrl,
  observationSchema,
  proposalSchema,
} from '../../packages/plugin-sdk/src/contracts.ts';
import type { PageObservation, ActionProposal } from '../../packages/plugin-sdk/src/contracts.ts';
export {
  identifier,
  websiteUrl,
  elementSchema,
  observationSchema,
  actionSchema,
  proposalSchema,
} from '../../packages/plugin-sdk/src/contracts.ts';
export type {
  PageObservation,
  BrowserAction,
  ActionProposal,
} from '../../packages/plugin-sdk/src/contracts.ts';
import type { PluginBridge } from './plugin-contracts.ts';
import type { DevelopmentBridge } from './development-contracts.ts';
import { z } from 'zod';

export const siteSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(100),
    url: websiteUrl,
    sessionId: identifier,
  })
  .strict();
export type Site = z.infer<typeof siteSchema>;
export const workspaceSchema = z
  .object({ version: z.literal(2), name: z.string(), sites: z.array(siteSchema).max(24) })
  .strict()
  .refine(
    (value) => new Set(value.sites.map((site) => site.id)).size === value.sites.length,
    '入口标识重复',
  );
export type Workspace = z.infer<typeof workspaceSchema>;
export const defaultWorkspace: Workspace = { version: 2, name: '我的工作台', sites: [] };
export const targetSchema = z.object({ tabId: identifier, sessionId: identifier }).strict();
export type TaskTarget = z.infer<typeof targetSchema>;
export const confirmationSchema = z
  .object({ id: identifier, proposal: proposalSchema, observation: observationSchema })
  .strict();
export type Confirmation = z.infer<typeof confirmationSchema>;
export const pageSchema = z
  .object({
    id: identifier,
    siteId: identifier,
    title: z.string(),
    url: z.string(),
    popup: z.boolean(),
    selected: z.boolean().optional(),
  })
  .strict();
export type BrowserPage = z.infer<typeof pageSchema>;
export interface BrowserAdapter {
  observe(target: TaskTarget, pageId?: string): Promise<PageObservation>;
  readback(target: TaskTarget, pageId: string): Promise<PageObservation>;
  execute(target: TaskTarget, proposal: ActionProposal, valid: () => boolean): Promise<void>;
  needsConfirmation(observation: PageObservation, proposal: ActionProposal): boolean;
  pages(target: TaskTarget): BrowserPage[];
  selectPage(target: TaskTarget, pageId: string): void;
  screenshot(target: TaskTarget, pageId: string): Promise<string>;
}
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
    pendingAction: confirmationSchema.nullable(),
    result: observationSchema.nullable(),
    requiresVerification: z.boolean(),
    steps: z.array(z.object({ id: z.string(), text: z.string() }).strict()),
    metrics: z
      .object({
        modelCalls: z.number(),
        toolCalls: z.number(),
        startedAt: z.number(),
        elapsedMs: z.number(),
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
    pendingAction: null,
    result: null,
    requiresVerification: false,
    steps: [],
    metrics: { modelCalls: 0, toolCalls: 0, startedAt: 0, elapsedMs: 0 },
  };
}
export const messageSchema = z
  .object({ id: z.string(), role: z.enum(['user', 'assistant']), text: z.string() })
  .strict();
export type ChatMessage = z.infer<typeof messageSchema>;
export const contextSchema = z
  .object({ siteId: identifier, task: taskSchema, messages: z.array(messageSchema) })
  .strict();
export type EntryContext = z.infer<typeof contextSchema>;
export const snapshotSchema = z
  .object({
    workspace: workspaceSchema,
    contexts: z.array(contextSchema),
    pages: z.array(pageSchema),
    activeSiteId: z.string(),
    runningSiteId: z.string().nullable(),
    runtimeConfigured: z.boolean(),
    preview: z.boolean(),
  })
  .strict();
export type WorkspaceSnapshot = z.infer<typeof snapshotSchema>;
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add-site'), url: websiteUrl, name: z.string().max(100) }).strict(),
  z
    .object({
      type: z.literal('edit-site'),
      siteId: identifier,
      url: websiteUrl,
      name: z.string().max(100),
    })
    .strict(),
  z.object({ type: z.literal('remove-site'), siteId: identifier }).strict(),
  z.object({ type: z.literal('select-site'), siteId: identifier }).strict(),
  z.object({ type: z.literal('select-page'), pageId: identifier }).strict(),
  z.object({ type: z.literal('close-page'), pageId: identifier }).strict(),
  z
    .object({
      type: z.literal('send'),
      text: z.string().trim().min(1).max(12000),
      tabId: identifier,
    })
    .strict(),
  z.object({ type: z.literal('confirm'), siteId: identifier, confirmationId: identifier }).strict(),
  z.object({ type: z.literal('stop'), siteId: identifier }).strict(),
  z.object({ type: z.literal('resume'), siteId: identifier }).strict(),
  z.object({ type: z.literal('new-task'), siteId: identifier }).strict(),
  z
    .object({
      type: z.literal('resolve-result'),
      siteId: identifier,
      outcome: z.enum(['verified', 'not-applied']),
    })
    .strict(),
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
  z.object({ type: z.literal('reload'), siteId: identifier }).strict(),
]);
export type WorkspaceCommand = z.infer<typeof commandSchema>;
export interface DeskworkBridge {
  development: DevelopmentBridge;
  plugins: PluginBridge;
  snapshot(): Promise<WorkspaceSnapshot>;
  command(command: WorkspaceCommand): Promise<void>;
  subscribe(listener: (snapshot: WorkspaceSnapshot) => void): () => void;
}
