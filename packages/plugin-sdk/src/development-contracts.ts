import { z } from 'zod';
import { identifier, proposalSchema } from './contracts.ts';

export const actionResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('executed-observe-again') }).strict(),
  z
    .object({ status: z.literal('waiting-for-human-confirmation'), confirmationId: identifier })
    .strict(),
]);
export type BrowserActionResult = z.infer<typeof actionResultSchema>;

export const developmentConnectionSchema = z
  .object({
    version: z.literal(1),
    endpoint: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'http:' &&
        url.hostname === '127.0.0.1' &&
        url.pathname === '/tools' &&
        !url.username &&
        !url.password
      );
    }),
    token: z.string().min(32),
    siteId: identifier,
    taskId: identifier,
  })
  .strict();
export type DevelopmentConnection = z.infer<typeof developmentConnectionSchema>;

export const developmentRequestSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('status'), arguments: z.object({}).strict() }).strict(),
  z
    .object({
      name: z.literal('observe'),
      arguments: z.object({ pageId: identifier.optional() }).strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal('act'),
      arguments: z
        .object({ proposal: proposalSchema, effect: z.enum(['read', 'write', 'unknown']) })
        .strict(),
    })
    .strict(),
  z.object({ name: z.literal('pages'), arguments: z.object({}).strict() }).strict(),
  z
    .object({
      name: z.literal('select-page'),
      arguments: z.object({ pageId: identifier }).strict(),
    })
    .strict(),
  z
    .object({ name: z.literal('capture'), arguments: z.object({ pageId: identifier }).strict() })
    .strict(),
  z.object({ name: z.literal('verify'), arguments: z.object({}).strict() }).strict(),
  z.object({ name: z.literal('stop'), arguments: z.object({}).strict() }).strict(),
]);
export type DevelopmentRequest = z.infer<typeof developmentRequestSchema>;

export const developmentStatusSchema = z
  .object({
    taskId: identifier,
    siteId: identifier,
    status: z.enum([
      'idle',
      'running',
      'waiting-user',
      'paused',
      'verifying',
      'succeeded',
      'failed',
      'cancelled',
    ]),
    detail: z.string(),
    requiresVerification: z.boolean(),
    confirmationId: identifier.nullable(),
    pendingAction: proposalSchema.nullable(),
  })
  .strict();
