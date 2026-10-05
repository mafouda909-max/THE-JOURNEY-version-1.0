import { preparePrivateStorageCors } from "../src/lib/b2";

async function main() {
  // A one-time production operator action with the existing key permissions.
  // Preview builds and ordinary requests never change provider configuration.
  if (process.env.VERCEL_ENV !== "production" || process.env.PRIVATE_STORAGE_CORS_PREPARE_ENABLED !== "true") return;
  try {
    const result = await preparePrivateStorageCors();
    console.log("STORAGE_CORS_SETUP_COMPLETED", { changed: result.changed });
  } catch (error) {
    // SDK errors may contain signed URLs, credentials or headers. Log a fixed
    // code only. Health/reservation still fail closed if browser PUT is blocked.
    const name = error instanceof Error ? error.name : "";
    const code = name === "AccessDenied" ? "PERMISSION_DENIED" : "CONFIGURATION_REQUIRED";
    console.error("STORAGE_CORS_SETUP_REQUIRES_OPERATOR", { code });
  }
}

void main();
