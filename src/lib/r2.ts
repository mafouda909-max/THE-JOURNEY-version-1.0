/**
 * Legacy compatibility shim.
 * New code must import from `@/lib/b2` or `@/lib/private-storage`.
 */
export {
  B2_ENDPOINT as R2_ENDPOINT,
  B2_BUCKET_NAME as R2_BUCKET,
  b2Configured as r2Configured,
  b2MissingVars as r2MissingVars,
  listMedia,
  createUploadUrl,
} from "@/lib/b2";
