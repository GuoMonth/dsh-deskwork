import { resolve } from 'node:path';
import {
  readRuntimeDescriptor,
  sealRuntime,
  verifyRuntime,
} from '../src/runtime/desktop-runtime.ts';
const root = resolve(process.argv[2] ?? '.artifacts/desktop-runtime');
const metadata = await readRuntimeDescriptor(root);
await sealRuntime(root, metadata);
await verifyRuntime(root);
