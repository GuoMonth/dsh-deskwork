import { createContext, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { defaultLocale, localizeMessage } from '../core/locale.ts';
import type { Locale } from '../core/locale.ts';

const LocaleContext = createContext<Locale>(defaultLocale);
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}): ReactElement {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useI18n(override?: Locale): (text: string) => string {
  const current = useContext(LocaleContext);
  const locale = override ?? current;
  return (text) => localizeMessage(locale, text);
}
