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
    family:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", sans-serif',
    body: '14px',
    small: '12px',
    title: '20px',
  },
  motion: { fast: '120ms', normal: '180ms' },
  size: { control: '32px', input: '36px', titlebar: '42px', sidebar: '204px', aiPanel: '400px' },
} as const;

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
    '\n}\n'
  );
}
