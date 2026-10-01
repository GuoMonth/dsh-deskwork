// Adapted from DeepSeek 639ed015 desktop runtime-file-policy.ts (MIT), packaging/DSH-LICENSE.
export function runtimeFileExclusion(
  path: string,
  target: { platform: string; arch: string },
): boolean {
  const parts = path.split(/[\\/]/);
  if (
    parts.some((part) =>
      ['.bin', '.pnpm', '.modules.yaml', '.pnpm-workspace-state-v1.json'].includes(part),
    )
  )
    return true;
  const file = parts.at(-1) ?? '';
  if (file === '.gitkeep') return true;
  if (/\.(?:[cm]?[jt]s|css)\.map$|\.d\.[cm]?ts$|\.tsbuildinfo$/.test(file)) return true;
  const packageParts = parts.slice(parts.lastIndexOf('node_modules') + 1);
  const nameParts = packageParts[0]?.startsWith('@') ? 2 : 1;
  const name = packageParts.slice(0, nameParts).join('/');
  const entry = packageParts.slice(nameParts).join('/');
  if (
    name.startsWith('@koromix/koffi-') &&
    name !== `@koromix/koffi-${target.platform}-${target.arch}`
  )
    return true;
  if (
    name.startsWith('@deepseek-ai/libreoffice-kit-') &&
    name !== `@deepseek-ai/libreoffice-kit-${target.platform}-${target.arch}`
  )
    return true;
  if (
    name === 'node-pty' &&
    entry.startsWith('prebuilds/') &&
    packageParts[nameParts + 1] !== `${target.platform}-${target.arch}`
  )
    return true;
  return false;
}
