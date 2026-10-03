export type GroundableVisaSource =
  | "VERIFIED"
  | "SOURCE_REPORTED"
  | "AGENT_REPORTED"
  | "AI_INFERRED"
  | "UNKNOWN";

export function groundedVisaDecision(input: {
  visaRequired: unknown;
  sourceType: GroundableVisaSource | string;
  freshnessStatus: string;
}): boolean | null {
  if (input.freshnessStatus !== "FRESH") return null;
  if (input.sourceType !== "VERIFIED" && input.sourceType !== "SOURCE_REPORTED") {
    return null;
  }
  return typeof input.visaRequired === "boolean" ? input.visaRequired : null;
}
