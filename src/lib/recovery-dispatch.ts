import { after } from "next/server";

export const recoveryDispatch = {
  schedule(task: () => Promise<void>) {
    after(async () => {
      try { await task(); }
      catch {
        // Fixed code only: no identity, token, provider output or error text.
        console.warn("[auth-recovery] dispatch_failed");
      }
    });
  },
};
