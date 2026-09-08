import { z } from 'zod';
import { identifier } from './contracts.ts';

export const developmentStateSchema = z
  .object({
    connected: z.boolean(),
    siteId: identifier.nullable(),
    configuration: z.string(),
  })
  .strict();
export type DevelopmentState = z.infer<typeof developmentStateSchema>;
export interface DevelopmentBridge {
  state(): Promise<DevelopmentState>;
  start(siteId: string): Promise<DevelopmentState>;
  stop(): Promise<void>;
}
