export const designTokens = {
  color: {
    canvas: '#f5f7fa',
    surface: '#ffffff',
    surfaceSubtle: '#f9fafc',
    text: '#172033',
    textMuted: '#647086',
    border: '#e1e6ee',
    brand: '#2563eb',
    brandSoft: '#edf3ff',
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
  radius: { control: '6px', panel: '10px', pill: '999px' },
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    body: '14px',
    small: '12px',
    title: '20px',
  },
  motion: { fast: '120ms', normal: '180ms' },
  size: { control: '32px', input: '36px', titlebar: '52px', sidebar: '204px', aiPanel: '400px' },
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
