# Workspace previews

Public UI checks use synthetic website fixtures. Screenshots are generated under the ignored `.artifacts/desktop/` directory by the desktop integration tests. Business screenshots and private integration materials are kept outside this repository.

Run `npm run build` and `xvfb-run -a node --test tests/desktop.integration.ts tests/plugin-desktop.integration.ts tests/development-desktop.integration.ts` to generate the current preview evidence.
