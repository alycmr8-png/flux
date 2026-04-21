import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = axios.create({ baseURL: BASE_URL });

export function useApiWithAuth() {
  const { getToken, userId } = useAuth();

  api.interceptors.request.use(async (config) => {
    config.headers["x-clerk-user-id"] = userId ?? "";
    return config;
  });

  return api;
}
