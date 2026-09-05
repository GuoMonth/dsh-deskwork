export interface WorkspaceTab {
  readonly id: string;
  readonly url: string;
  readonly sessionPartition: `persist:${string}`;
}

export function parseWorkspaceConfiguration(input: unknown): readonly WorkspaceTab[] {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('tabs' in input) ||
    !Array.isArray(input.tabs) ||
    input.tabs.length === 0
  ) {
    throw new Error('Workspace configuration requires a nonempty tabs array');
  }
  const configuredTabs: readonly unknown[] = input.tabs;
  const identities = new Set<string>();
  return configuredTabs.map((tab): WorkspaceTab => {
    if (
      typeof tab !== 'object' ||
      tab === null ||
      !('id' in tab) ||
      typeof tab.id !== 'string' ||
      !tab.id.trim() ||
      !('url' in tab) ||
      typeof tab.url !== 'string'
    ) {
      throw new Error('Each tab requires an id and URL');
    }
    if (identities.has(tab.id)) throw new Error(`Duplicate tab id: ${tab.id}`);
    identities.add(tab.id);
    if (!URL.canParse(tab.url) || !['http:', 'https:'].includes(new URL(tab.url).protocol)) {
      throw new Error('Tab URL must use HTTP or HTTPS');
    }
    if (
      !('sessionPartition' in tab) ||
      typeof tab.sessionPartition !== 'string' ||
      !tab.sessionPartition.startsWith('persist:') ||
      tab.sessionPartition.slice(8).trim().length === 0
    ) {
      throw new Error('Each tab requires a named persistent partition');
    }
    return {
      id: tab.id,
      url: tab.url,
      sessionPartition: `persist:${tab.sessionPartition.slice(8)}`,
    };
  });
}
