// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as WebAssembly. The page also has to be
// cross-origin isolated; the published demo gets that from
// public/coi-serviceworker.js (see .github/workflows/pages.yml).
config.resolver.assetExts.push("wasm");

module.exports = config;
