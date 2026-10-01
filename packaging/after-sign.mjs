import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export default function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const application = join(context.appOutDir, 'DSH Deskwork.app');
  // Native signatures change their bytes. Seal those final resources, then sign the outer bundle.
  execFileSync(
    process.execPath,
    ['scripts/seal-runtime.ts', join(application, 'Contents/Resources/runtime')],
    { stdio: 'inherit' },
  );
  execFileSync(
    'codesign',
    [
      '--force',
      '--sign',
      '-',
      '--options',
      'runtime',
      '--entitlements',
      resolve('packaging/macos-entitlements.plist'),
      application,
    ],
    { stdio: 'inherit' },
  );
}
