// Adapted from DeepSeek 1f81c047 desktop runtime-file-policy.ts (MIT), packaging/DSH-LICENSE.
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
  if (name === '@mixmark-io/domino' && (entry === '.yarn' || entry.startsWith('.yarn/')))
    return true;
  if (
    name === 'fs-ext' &&
    /^build\/(?:Release|Debug)\/(?:obj(?:\/|$)|fs_ext\.(?:exp|lib|pdb|iobj|ipdb)$)/.test(entry)
  )
    return true;
  if (
    name === 'fs-ext' &&
    /^build\/(?:binding\.sln|config\.gypi|fs_ext\.vcxproj(?:\.filters)?)$/.test(entry)
  )
    return true;
  if (name === '@mixmark-io/domino' && (entry === 'test' || entry.startsWith('test/'))) return true;
  if (
    name === 'node-pty' &&
    target.platform !== 'win32' &&
    /^third_party\/conpty(?:\/|$)/.test(entry)
  )
    return true;
  if (name === 'node-pty' && entry.startsWith('prebuilds/')) {
    const platform = packageParts[nameParts + 1];
    if (platform !== undefined && platform !== `${target.platform}-${target.arch}`) return true;
    if (file.endsWith('.pdb')) return true;
  }
  if (name === '@koromix/koffi-win32-x64' && entry === 'win32_x64/koffi.lib') return true;
  return false;
}
