export type BrandMark = { readonly viewBox: string; readonly content: string };

/**
 * Split the canonical SVG so the shell can inline its drawing without re-declaring the geometry in
 * the component. A change to `packaging/brand/mark.svg` reaches the UI, the icons and the tray.
 */
export function brandMark(svg: string): BrandMark {
  const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg.trim());
  const viewBox = root?.[1] ? /\bviewBox="([^"]+)"/.exec(root[1])?.[1] : undefined;
  const content = root?.[2]?.trim();
  if (!viewBox || !content) throw new Error('The canonical brand SVG must declare a viewBox');
  return { viewBox, content };
}
