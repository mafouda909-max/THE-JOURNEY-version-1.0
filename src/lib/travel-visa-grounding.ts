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
  decisionBasis?: unknown;
}): boolean | null {
  if (input.freshnessStatus !== "FRESH") return null;
  if (input.sourceType !== "VERIFIED" && input.sourceType !== "SOURCE_REPORTED") {
    return null;
  }

  // Legacy/search-derived rows did not record how the boolean was established.
  // Do not convert those rows into entry-rule claims. Only a structured,
  // authoritative extraction that explicitly records its basis can decide.
  if (input.decisionBasis !== "structured_authoritative") return null;

  return typeof input.visaRequired === "boolean" ? input.visaRequired : null;
}
