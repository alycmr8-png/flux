import * as SecureStore from "expo-secure-store";

// Shape matches Clerk's TokenCache (the dist/cache type export moved in newer
// @clerk/clerk-expo versions, so we type it structurally).
export const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, token: string) {
    return SecureStore.setItemAsync(key, token);
  },
};
