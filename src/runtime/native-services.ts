import type { Context } from '@deepseek-ai/cordis';
import BrowserUse from '@deepseek-ai/dsh-browser-use';
import Approval from '@deepseek-ai/dsh-user-approval';
import * as FilesystemSkills from '@deepseek-ai/dsh-skill-filesystem';

export const name = 'deskwork-native-services';
export const inject = ['skills'];

/** Resolve host-owned native packages from the app, even with a separately installed plugin profile. */
export async function apply(ctx: Context, config: { skillDirectory: string }): Promise<void> {
  await ctx.plugin(BrowserUse);
  await ctx.plugin(Approval);
  await ctx.plugin(FilesystemSkills, {
    includeDefaultRoots: false,
    customSkillDirs: [config.skillDirectory],
  });
}
