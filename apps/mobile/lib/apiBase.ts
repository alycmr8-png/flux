import Constants from "expo-constants";

/**
 * Where the API lives. In a release build this is EXPO_PUBLIC_API_URL. During
 * development (Expo Go) the API runs on the same computer as the Expo dev server,
 * so when the configured address is a local/LAN one, the app uses the address it
 * already reaches Expo through — changing Wi-Fi then no longer breaks it.
 */
const CONFIGURED = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function resolve(): string {
  try {
    const url = new URL(CONFIGURED);
    const devHost = (Constants.expoConfig?.hostUri ?? "").split(":")[0];
    if (__DEV__ && devHost && LOCAL_HOST.test(url.hostname) && LOCAL_HOST.test(devHost)) {
      return `${url.protocol}//${devHost}:${url.port || "3001"}`;
    }
  } catch { /* malformed setting — use it as given */ }
  return CONFIGURED;
}

export const API_BASE = resolve();
