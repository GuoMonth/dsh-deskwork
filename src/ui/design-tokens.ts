export const designTokens = {
  color: {
    canvas: '#ededee',
    surface: '#ffffff',
    surfaceSubtle: '#f5f5f5',
    text: '#202124',
    textMuted: '#595b61',
    border: '#d4d5d8',
    controlBorder: '#92959c',
    hover: '#e4e5e7',
    selected: '#dde5f2',
    onBrand: '#ffffff',
    brandHover: '#1d4ed8',
    brand: '#2563eb',
    brandSoft: '#eef3fb',
    agent: '#0e7490',
    agentSoft: '#ecf8fa',
    success: '#157347',
    successSoft: '#edf8f1',
    warning: '#946000',
    warningSoft: '#fff7e5',
    danger: '#c0353d',
    dangerSoft: '#fff0f1',
  },
  space: {
    one: '4px',
    two: '8px',
    three: '12px',
    four: '16px',
    five: '20px',
    six: '24px',
    eight: '32px',
    ten: '40px',
  },
  radius: { control: '6px', panel: '8px', pill: '999px' },
  font: {
    codeFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    family:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", sans-serif',
    body: '14px',
    small: '12px',
    title: '20px',
  },
  motion: { fast: '120ms', normal: '180ms' },
  size: { control: '32px', input: '36px', titlebar: '42px', sidebar: '204px', aiPanel: '400px' },
} as const;

/** Official primitives consume the same semantic roles; no second color palette. */
const officialAliases: Record<string, string> = {
  'alias-label-primary': 'var(--color-text)',
  'alias-label-secondary': 'var(--color-text-muted)',
  'alias-label-tertiary': 'var(--color-text-muted)',
  'alias-label-caption': 'var(--color-text-muted)',
  'alias-label-primary-foreground': 'var(--color-on-brand)',
  'alias-bg-base': 'var(--color-surface)',
  'alias-border-l1': 'var(--color-border)',
  'alias-border-l2': 'var(--color-border)',
  'alias-border-l3': 'var(--color-control-border)',
  'alias-link': 'var(--color-brand)',
  'alias-button-primary-fill': 'var(--color-brand)',
  'alias-button-primary-hover': 'var(--color-brand-hover)',
  'alias-button-tool-bar-fill': 'var(--color-surface-subtle)',
  'alias-button-tool-bar-hover': 'var(--color-hover)',
  'alias-interactive-bg-hover': 'var(--color-hover)',
  'alias-interactive-bg-active': 'var(--color-selected)',
  'alias-state-success-primary': 'var(--color-success)',
  'alias-state-warn-primary': 'var(--color-warning)',
  'alias-state-error-primary': 'var(--color-danger)',
  'alias-state-idle-primary': 'var(--color-text-muted)',
  'alias-state-business-primary': 'var(--color-agent)',
  'alias-markdown-inline-code': 'var(--color-surface-subtle)',
  'alias-markdown-code-block': 'var(--color-surface-subtle)',
  'alias-markdown-code-block-banner': 'var(--color-canvas)',
  'radius-xs': 'var(--radius-control)',
  'radius-sm': 'var(--radius-control)',
  'radius-md': 'var(--radius-control)',
  'radius-lg': 'var(--radius-panel)',
  'font-family': 'var(--font-family)',
  'font-xs-13': '400 var(--font-small)/1.5 var(--font-family)',
  'font-markdown-base': '400 var(--font-body)/1.6 var(--font-family)',
  'font-markdown-base-strong': '600 var(--font-body)/1.6 var(--font-family)',
  'font-markdown-h1': '600 var(--font-title)/1.5 var(--font-family)',
  'font-markdown-h2': '600 var(--font-title)/1.5 var(--font-family)',
  'font-markdown-h3': '600 var(--font-body)/1.5 var(--font-family)',
  'font-markdown-h4': '600 var(--font-body)/1.5 var(--font-family)',
  'font-markdown-table': '400 var(--font-small)/1.5 var(--font-family)',
  'font-markdown-table-head': '600 var(--font-small)/1.5 var(--font-family)',
  'font-markdown-code': '400 var(--font-small)/1.5 var(--font-code-family)',
  'font-markdown-code-block': '400 var(--font-small)/1.5 var(--font-code-family)',
  'focus-ring-color': 'var(--color-brand)',
  'focus-ring-width': 'calc(var(--space-one) / 2)',
};

export function tokenStylesheet(): string {
  return (
    ':root {\n' +
    Object.entries(designTokens)
      .flatMap(([group, values]) =>
        Object.entries(values).map(
          ([name, value]) =>
            `  --${group}-${name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())}: ${value};`,
        ),
      )
      .join('\n') +
    '\n' +
    Object.entries(officialAliases)
      .map(([name, value]) => `  --dsw-${name}: ${value};`)
      .join('\n') +
    '\n}\n'
  );
}
