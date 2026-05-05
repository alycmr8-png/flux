const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force Metro to resolve React from the mobile app only (prevents duplicates)
// Also pin @sano/* to their source directories so Metro doesn't chase broken symlinks
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "@sano/i18n": path.resolve(workspaceRoot, "packages/i18n"),
  "@sano/shared": path.resolve(workspaceRoot, "packages/shared"),
};

// Stub native modules not compiled in the dev build
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes("ExpoCryptoAES") || moduleName.includes("expo-crypto/build/aes")) {
    return { type: "sourceFile", filePath: path.resolve(projectRoot, "shims/ExpoCryptoAES.js") };
  }
  if (moduleName.includes("@react-native-async-storage/async-storage")) {
    return { type: "sourceFile", filePath: path.resolve(projectRoot, "shims/AsyncStorage.js") };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
