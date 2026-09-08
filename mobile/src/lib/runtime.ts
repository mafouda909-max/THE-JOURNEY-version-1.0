/**
 * React Native side of configuration + persistence. Kept separate from
 * `config.ts` / `cache.ts` so those stay importable by Node unit tests.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { isUsableStore, type KvStore } from "./cache";
import { resolveApiConfig, type ResolvedApiConfig } from "./config";

export type RuntimeConfig = ResolvedApiConfig;

interface ExpoExtra {
  apiBaseUrl?: unknown;
}

/** `Constants.expoConfig` is null in some bare-workflow/dev-server setups. */
function readExpoConfig(): { extra: ExpoExtra; hostUri: string | null } {
  const config = Constants.expoConfig as
    | { extra?: ExpoExtra | null; hostUri?: string | null }
    | null;
  return {
    extra: (config?.extra ?? {}) as ExpoExtra,
    hostUri: typeof config?.hostUri === "string" ? config.hostUri : null,
  };
}

/** `__DEV__` is injected by Metro; read it defensively so plain Node can import this module. */
function isDevelopment(): boolean {
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

export function resolveRuntimeConfig(): RuntimeConfig {
  const { extra, hostUri } = readExpoConfig();
  return resolveApiConfig({
    appConfigBaseUrl: extra.apiBaseUrl,
    envBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    packagerHostUri: hostUri,
    isDev: isDevelopment(),
  });
}

/** Degrades to a no-op store if the native module is missing (e.g. web preview). */
export const deviceStore: KvStore = isUsableStore(AsyncStorage)
  ? (AsyncStorage as unknown as KvStore)
  : {
      async getItem() {
        return null;
      },
      async setItem() {
        /* no persistence available */
      },
      async removeItem() {
        /* nothing to clear */
      },
    };
