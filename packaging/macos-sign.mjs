/**
 * Skip `@electron/osx-sign`'s recursive walk. The sealed runtime has far more
 * files than the macOS descriptor limit, and the walker opens all of them.
 * `after-sign.mjs` seals the runtime and deep-signs the completed bundle.
 */
export default async function sign() {}
