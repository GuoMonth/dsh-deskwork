import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceApp } from './workspace-app.tsx';
import { createPreviewBridge } from './preview-bridge.ts';
import type { DeskworkBridge } from '../core/contracts.ts';
import './tokens.css';
import './workspace.css';

declare global {
  interface Window {
    deskwork?: DeskworkBridge;
  }
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
const bridge = window.deskwork ?? createPreviewBridge();
createRoot(root).render(
  <StrictMode>
    <WorkspaceApp bridge={bridge} />
  </StrictMode>,
);
