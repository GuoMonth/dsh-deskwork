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
if (!window.deskwork && window.location.protocol === 'file:') {
  root.textContent = '无法连接 Deskwork 桌面宿主，请重新启动或检查安装包。';
  throw new Error('Desktop preload bridge unavailable; refusing synthetic fallback');
}
const bridge = window.deskwork ?? createPreviewBridge();
createRoot(root).render(
  <StrictMode>
    <WorkspaceApp bridge={bridge} />
  </StrictMode>,
);
