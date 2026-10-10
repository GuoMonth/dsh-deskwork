import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ReactElement } from 'react';
import type { Locale } from '../core/locale.ts';

const labels = {
  en: { code: { copyLabel: 'Copy', copiedLabel: 'Copied' }, footnotes: 'Footnotes' },
  zh: { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '脚注' },
};
export function AssistantMessage({
  text,
  locale,
  streaming,
}: {
  text: string;
  locale: Locale;
  streaming: boolean;
}): ReactElement {
  return (
    <MarkdownText text={text} labels={labels[locale]} streaming={streaming} variant="compact" />
  );
}
