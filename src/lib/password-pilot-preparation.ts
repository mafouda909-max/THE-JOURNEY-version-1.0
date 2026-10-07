const LEGACY_NEON_PROJECT_ID = "late-mountain-20124572";

type PreparationEnvironment = {
  VERCEL_ENV?: string;
  PASSWORD_PILOT_PREPARE_ENABLED?: string;
  PASSWORD_PILOT_PREVIEW_PREPARE_ENABLED?: string;
};

export type PasswordPilotPreparationMode = "production" | "preview";

export function passwordPilotPreparationMode(
  environment: PreparationEnvironment,
): PasswordPilotPreparationMode | null {
  if (
    environment.VERCEL_ENV === "production" &&
    environment.PASSWORD_PILOT_PREPARE_ENABLED === "true"
  ) {
    return "production";
  }
  if (
    environment.VERCEL_ENV === "preview" &&
    environment.PASSWORD_PILOT_PREVIEW_PREPARE_ENABLED === "true"
  ) {
    return "preview";
  }
  return null;
}

export function validatePasswordPilotDatabaseIdentity(input: {
  projectId: string;
  branchId: string;
}): void {
  if (!input.projectId || !input.branchId) {
    throw new Error("Refusing password pilot preparation on an unknown database identity.");
  }
  if (input.projectId === LEGACY_NEON_PROJECT_ID) {
    throw new Error("Refusing password pilot preparation on a legacy database.");
  }
}
