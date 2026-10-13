import type { ReactElement, SVGProps } from 'react';
import markSvg from '../../../packaging/brand/mark.svg?raw';

const markContent = markSvg.replace(/^<[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

export function BrandMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      {...props}
      dangerouslySetInnerHTML={{ __html: markContent }}
    />
  );
}
