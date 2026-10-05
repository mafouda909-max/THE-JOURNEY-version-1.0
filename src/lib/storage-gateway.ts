import * as storage from "@/lib/b2";
import { capabilityRuntime } from "@/lib/capabilities/production";

export { B2_ENDPOINT, B2_BUCKET_NAME, b2Configured, b2MissingVars } from "@/lib/b2";
export const listMedia = (prefix?: string, maxKeys?: number) => capabilityRuntime.call("storage", "admin", (signal) => storage.listMedia(prefix, maxKeys, signal));
export const createUploadUrl = (...args: Parameters<typeof storage.createUploadUrl>) => capabilityRuntime.call("storage", "admin", () => storage.createUploadUrl(...args));
export const privateObjectInfo = (storageKey: string) => capabilityRuntime.call("storage", "system", (signal) => storage.privateObjectInfo(storageKey, signal));
export const transferPrivateDocument = (key: string, bytes: Buffer, contentType: string) => capabilityRuntime.call("storage", "system", (signal) => storage.transferPrivateDocument(key, bytes, contentType, signal));
export const createPrivateUploadUrl = (key: string, contentType: string, contentLength?: number) => capabilityRuntime.call("storage", "system", (signal) => storage.createPrivateUploadUrl(key, contentType, contentLength, signal));
export const createPrivateDownloadUrl = (...args: Parameters<typeof storage.createPrivateDownloadUrl>) => capabilityRuntime.call("storage", "system", () => storage.createPrivateDownloadUrl(...args));
