import { z } from 'zod';

export const packageNameSchema = z
  .string()
  .max(214)
  .regex(/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/);
export const installSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (source) =>
      /^file:\/[^\r\n]+$/.test(source) ||
      /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*(?:@[a-zA-Z0-9.^~*+-]+)?$/.test(source) ||
      /^https:\/\/(?:github\.com|codeload\.github\.com)\/[^\s?#]+(?:[?#][^\s]*)?$/.test(source) ||
      /^github:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:#[a-zA-Z0-9_./-]+)?$/.test(source),
    '请输入 npm 包名、GitHub 地址或 file:/ 本地插件目录',
  );
export const installedPluginSchema = z
  .object({
    name: packageNameSchema,
    version: z.string(),
    source: z.string(),
    installationId: z.uuid(),
    mountName: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_-]+$/),
    enabled: z.boolean(),
    siteIds: z.array(z.string()).max(24),
  })
  .strict();
export type InstalledPlugin = z.infer<typeof installedPluginSchema>;
export const pluginStateSchema = z
  .object({
    installed: z.array(installedPluginSchema),
    busy: z.boolean(),
    progress: z.string(),
  })
  .strict();
export type PluginState = z.infer<typeof pluginStateSchema>;
export const marketPluginSchema = z
  .object({
    name: z.string(),
    owner: z.string(),
    url: z.url(),
    description: z.string(),
    source: installSourceSchema,
  })
  .strict();
export type MarketPlugin = z.infer<typeof marketPluginSchema>;
export const pluginCommandSchema = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('install'), source: installSourceSchema, trusted: z.literal(true) })
    .strict(),
  z.object({ action: z.literal('update'), name: packageNameSchema }).strict(),
  z.object({ action: z.literal('remove'), name: packageNameSchema }).strict(),
  z
    .object({
      action: z.literal('configure'),
      name: packageNameSchema,
      mountName: installedPluginSchema.shape.mountName,
      enabled: z.boolean(),
      siteIds: installedPluginSchema.shape.siteIds,
    })
    .strict(),
]);
export type PluginCommand = z.infer<typeof pluginCommandSchema>;
export interface PluginBridge {
  state(): Promise<PluginState>;
  search(query: string): Promise<MarketPlugin[]>;
  command(command: PluginCommand): Promise<void>;
}
