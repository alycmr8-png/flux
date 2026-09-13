import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

type GetToken = () => Promise<string | null>;

function makeInstance(getToken: GetToken) {
  // Lecture uploads are multi-megabyte and processing is long-running, so the
  // default read timeout has to be generous or a long lecture dies mid-upload.
  const instance = axios.create({ baseURL: BASE_URL, timeout: 15 * 60 * 1000 });
  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
    return config;
  });
  return instance;
}

export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => makeInstance(getToken), [getToken]);
}

export function makeApiFetcher(getToken: GetToken) {
  const instance = makeInstance(getToken);
  return (url: string) => instance.get(url).then((r) => r.data);
}
