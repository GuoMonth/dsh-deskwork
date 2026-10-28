import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export default function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const application = join(context.appOutDir, 'DSH Deskwork.app');
  const entitlements = resolve('packaging/macos-entitlements.plist');
  const sign = (deep) =>
    execFileSync(
      'codesign',
      [
        '--force',
        ...(deep ? ['--deep'] : []),
        '--sign',
        '-',
        '--options',
        'runtime',
        '--entitlements',
        entitlements,
        application,
      ],
      { stdio: 'inherit' },
    );
  // Native signatures change their bytes. Sign all nested code first, seal
  // those final resources, then refresh the outer bundle's resource seal.
  sign(true);
  execFileSync(
    process.execPath,
    ['scripts/seal-runtime.ts', join(application, 'Contents/Resources/runtime')],
    { stdio: 'inherit' },
  );
  sign(false);
}
