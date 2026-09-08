import { z } from 'zod';

export const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const websiteUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
}, '请输入不含账号密码的 HTTP 或 HTTPS 网址');
export const elementSchema = z
  .object({
    ref: z.string(),
    tag: z.string(),
    role: z.string(),
    name: z.string(),
    value: z.string(),
    type: z.string(),
    href: z.string(),
    disabled: z.boolean(),
    options: z
      .array(z.object({ label: z.string(), value: z.string(), disabled: z.boolean() }).strict())
      .optional(),
  })
  .strict();
export const observationSchema = z
  .object({
    pageId: identifier,
    revision: z.string(),
    url: websiteUrl,
    title: z.string(),
    text: z.string(),
    elements: z.array(elementSchema),
    // Optional only for persisted observations from earlier previews.
    focusedRef: z.string().nullable().optional(),
  })
  .strict();
export type PageObservation = z.infer<typeof observationSchema>;
export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('click'), ref: z.string().min(1) }).strict(),
  z
    .object({ kind: z.literal('fill'), ref: z.string().min(1), value: z.string().max(12000) })
    .strict(),
  z
    .object({ kind: z.literal('select'), ref: z.string().min(1), value: z.string().max(1000) })
    .strict(),
  z.object({ kind: z.literal('navigate'), url: websiteUrl }).strict(),
  z.object({ kind: z.literal('scroll'), direction: z.enum(['up', 'down']) }).strict(),
  z
    .object({
      kind: z.literal('key'),
      key: z.enum(['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'Enter', 'Space']),
    })
    .strict(),
]);
export type BrowserAction = z.infer<typeof actionSchema>;
export const proposalSchema = z
  .object({
    pageId: identifier,
    revision: z.string(),
    action: actionSchema,
    summary: z.string().min(1).max(1000),
    expectedText: z.string().min(2).max(1000).optional(),
    risk: z.enum(['ordinary', 'consequential']),
  })
  .strict();
export type ActionProposal = z.infer<typeof proposalSchema>;
