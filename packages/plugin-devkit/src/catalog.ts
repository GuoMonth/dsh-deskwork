import { readFile } from 'node:fs/promises';

export const documents = [
  { id: 'start', title: '开发入口与安装', file: 'README.md' },
  { id: 'workflow', title: '开发流程与最小验收', file: 'docs/workflow.md' },
  { id: 'contract', title: '宿主与插件契约', file: 'docs/contract.md' },
  { id: 'skill', title: '插件开发 Skill', file: 'skills/develop-deskwork-plugin/SKILL.md' },
  { id: 'sdk', title: 'SDK 类型与 Schema 源文件', file: 'docs/sdk-contracts.txt' },
] as const;

export async function readDocument(id: string): Promise<string> {
  const document = documents.find((entry) => entry.id === id);
  if (!document) throw new Error(`Unknown document: ${id}`);
  return readFile(new URL(`../${document.file}`, import.meta.url), 'utf8');
}

export async function searchDocuments(
  query: string,
): Promise<Array<{ id: string; title: string; excerpt: string }>> {
  const results: Array<{ id: string; title: string; excerpt: string }> = [];
  for (const document of documents) {
    const content = await readDocument(document.id);
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index >= 0)
      results.push({
        id: document.id,
        title: document.title,
        excerpt: content.slice(Math.max(0, index - 100), index + 500),
      });
  }
  return results;
}

export const developmentCapabilities = {
  version: '0.1.0-alpha.1',
  dshVersion: '0.1.5-alpha.1',
  sdkPackage: '@guomonth/deskwork-plugin-sdk',
  sdkVersion: '0.1.0-alpha.1',
  documentation: 'offline',
  browserConnection: 'explicit-desktop-connection',
  browserSdk: ['observe', 'act'],
  builtinDshService: 'deskworkBrowser',
  bundledDevelopmentSkill: true,
  automaticConfirmationResume: false,
  compatibilityPromise: false,
} as const;
