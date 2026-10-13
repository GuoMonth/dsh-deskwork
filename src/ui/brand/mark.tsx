import type { ReactElement, SVGProps } from 'react';
import markSvg from '../../../packaging/brand/mark.svg?raw';
import { brandMark } from './mark-content.ts';

const mark = brandMark(markSvg);

export function BrandMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox={mark.viewBox}
      aria-hidden="true"
      focusable="false"
      {...props}
      dangerouslySetInnerHTML={{ __html: mark.content }}
    />
  );
}
