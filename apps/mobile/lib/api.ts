import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

function makeInstance(userId: string | null | undefined) {
  const instance = axios.create({ baseURL: BASE_URL, timeout: 120000 });
  instance.interceptors.request.use((config) => {
    config.headers["x-clerk-user-id"] = userId ?? "";
    return config;
  });
  return instance;
}

export function useApi() {
  const { userId } = useAuth();
  return useMemo(() => makeInstance(userId), [userId]);
}

export function makeApiFetcher(userId: string | null | undefined) {
  const instance = makeInstance(userId);
  return (url: string) => instance.get(url).then((r) => r.data);
}
