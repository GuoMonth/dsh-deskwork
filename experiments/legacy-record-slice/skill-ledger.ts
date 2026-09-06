import { z } from 'zod';
import type { BusinessRecord, TaskTarget } from './contracts.ts';

export const skillEntrySchema = z
  .object({
    key: z.string(),
    profileId: z.string(),
    version: z.literal(1),
    verifiedRuns: z.number().int().positive(),
    lastVerifiedAt: z.number(),
    elapsedMs: z.number().nonnegative(),
    toolCalls: z.number().int().nonnegative(),
    modelCalls: z.number().int().nonnegative(),
  })
  .strict();
export type SkillEntry = z.infer<typeof skillEntrySchema>;
export function skillKey(target: TaskTarget, record: BusinessRecord): string {
  return JSON.stringify([
    target.sessionId,
    target.profileId,
    record.shopId,
    record.field,
    record.pageRevision,
  ]);
}
export class SkillLedger {
  private entries: SkillEntry[];
  constructor(raw: unknown = []) {
    this.entries = z.array(skillEntrySchema).parse(raw);
  }
  canReuse(target: TaskTarget, record: BusinessRecord): boolean {
    return this.entries.some((entry) => entry.key === skillKey(target, record));
  }
  verified(
    target: TaskTarget,
    record: BusinessRecord,
    metrics: { elapsedMs: number; toolCalls: number; modelCalls: number },
  ): readonly SkillEntry[] {
    const key = skillKey(target, record);
    const prior = this.entries.find((entry) => entry.key === key);
    this.entries = [
      ...this.entries.filter((entry) => entry.key !== key),
      {
        key,
        profileId: target.profileId,
        version: 1,
        verifiedRuns: (prior?.verifiedRuns ?? 0) + 1,
        lastVerifiedAt: Date.now(),
        elapsedMs: metrics.elapsedMs,
        toolCalls: metrics.toolCalls,
        modelCalls: metrics.modelCalls,
      },
    ];
    return this.entries;
  }
}
