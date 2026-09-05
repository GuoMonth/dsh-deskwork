import { app, BaseWindow, WebContentsView } from 'electron';
import type { WebContents } from 'electron';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { parseWorkspaceConfiguration } from './workspace-configuration.ts';

async function evaluatePage(contents: WebContents, expression: string): Promise<unknown> {
  // Electron declares CDP responses as any; keep that external value unknown until validated.
  const response: unknown = await contents.debugger.sendCommand('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (
    typeof response !== 'object' ||
    response === null ||
    'exceptionDetails' in response ||
    !('result' in response) ||
    typeof response.result !== 'object' ||
    response.result === null ||
    !('value' in response.result)
  ) {
    throw new Error('CDP evaluation did not return a serializable value');
  }
  return response.result.value;
}

async function collectFromPages(
  views: readonly WebContentsView[],
  expression: string,
): Promise<readonly unknown[]> {
  return Promise.all(
    views.map(async (view): Promise<unknown> => evaluatePage(view.webContents, expression)),
  );
}

async function runProbe(): Promise<void> {
  const [phase, profileDirectory, configurationPath, reportPath] = process.argv.slice(2);
  if (
    (phase !== 'seed' && phase !== 'restore') ||
    !profileDirectory ||
    !configurationPath ||
    !reportPath
  ) {
    throw new Error('Expected phase, profile directory, workspace configuration and report path');
  }
  app.setPath('userData', profileDirectory);
  await app.whenReady();
  const rawConfiguration: unknown = JSON.parse(await readFile(configurationPath, 'utf8'));
  const tabs = parseWorkspaceConfiguration(rawConfiguration);
  const window = new BaseWindow({ width: 1100, height: 520, show: true });
  const views = tabs.map((tab, index): WebContentsView => {
    const view = new WebContentsView({
      webPreferences: {
        partition: tab.sessionPartition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    window.contentView.addChildView(view);
    view.setBounds({ x: index * 360, y: 0, width: 360, height: 500 });
    return view;
  });
  try {
    for (const [index, view] of views.entries()) {
      const tab = tabs[index];
      if (!tab) throw new Error('Missing tab configuration');
      await view.webContents.loadURL(tab.url);
      view.webContents.debugger.attach('1.3');
    }
    const sessionStatusExpression = "fetch('/api/session').then(response => response.status)";
    const initialSessionStatuses = await collectFromPages(views, sessionStatusExpression);
    const firstPage = views[0]?.webContents;
    if (!firstPage) throw new Error('No page available for the login experiment');
    if (phase === 'seed') {
      const navigation = once(firstPage, 'did-finish-load');
      await evaluatePage(firstPage, "document.querySelector('#login').requestSubmit(); true");
      await navigation;
    }
    const authenticatedSessionStatuses = await collectFromPages(views, sessionStatusExpression);
    await evaluatePage(firstPage, "document.querySelector('#increment').click(); true");
    const clickCounts = await collectFromPages(
      views,
      "Number(document.querySelector('#count').textContent)",
    );
    const nodeExposure = await collectFromPages(views, "typeof require + '/' + typeof process");
    for (const session of new Set(views.map((view) => view.webContents.session))) {
      await session.cookies.flushStore();
      session.flushStorageData();
    }
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          phase,
          electronVersion: process.versions['electron'],
          chromiumVersion: process.versions['chrome'],
          observations: {
            configuredTabIds: tabs.map((tab) => tab.id),
            distinctPageTargets: new Set(views.map((view) => view.webContents.id)).size,
            initialSessionStatuses,
            authenticatedSessionStatuses,
            clickCounts,
            nodeExposure,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    for (const view of views) view.webContents.close();
    window.close();
  }
}

runProbe()
  .then(() => {
    app.quit();
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
