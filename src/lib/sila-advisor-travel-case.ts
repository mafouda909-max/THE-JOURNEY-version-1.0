import {
  extractSilaAdvisorIntent,
  selectSilaAdvisorMissingQuestions,
  summarizeSilaAdvisorUnderstanding,
  type SilaAdvisorField,
  type SilaAdvisorIntentDraft,
  type SilaAdvisorRole,
} from "./sila-advisor-intake";

export type SilaTravelCaseFieldKey = keyof SilaAdvisorIntentDraft["fields"];

export interface SilaTravelCaseMessage {
  id: string;
  text: string;
  role: SilaAdvisorRole;
  capturedAt: string;
}

export interface SilaTravelCaseChange {
  field: SilaTravelCaseFieldKey;
  previousValue: string | null;
  nextValue: string;
  provenance: SilaAdvisorField["provenance"];
}

export interface SilaTravelCaseSnapshot {
  id: string;
  title: string;
  role: SilaAdvisorRole;
  fields: SilaAdvisorIntentDraft["fields"];
  messages: SilaTravelCaseMessage[];
  changes: SilaTravelCaseChange[];
  updatedAt: string;
}

const FIELD_LABELS: Record<SilaTravelCaseFieldKey, string> = {
  nationality: "الجنسية",
  destination: "الوجهة",
  purpose: "الغرض",
  dateWindow: "التوقيت",
  travelers: "المسافرون",
  budget: "الميزانية",
  origin: "الانطلاق",
  transit: "الترانزيت",
  passportStatus: "الجواز",
  accommodation: "الإقامة",
  returnTicket: "العودة",
};

const FIELD_KEYS = Object.keys(FIELD_LABELS) as SilaTravelCaseFieldKey[];

function makeCaseId(intent: SilaAdvisorIntentDraft, now: Date) {
  const destination = intent.fields.destination.value ?? "trip";
  const normalizedDestination = destination
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .slice(0, 32);
  return `sila-${normalizedDestination || "trip"}-${now.toISOString().slice(0, 10)}`;
}

function makeMessageId(now: Date, index: number) {
  return `msg-${now.toISOString()}-${index}`;
}

function cloneFields(fields: SilaAdvisorIntentDraft["fields"]): SilaAdvisorIntentDraft["fields"] {
  return {
    nationality: { ...fields.nationality },
    destination: { ...fields.destination },
    purpose: { ...fields.purpose },
    dateWindow: { ...fields.dateWindow },
    travelers: { ...fields.travelers },
    budget: { ...fields.budget },
    origin: { ...fields.origin },
    transit: { ...fields.transit },
    passportStatus: { ...fields.passportStatus },
    accommodation: { ...fields.accommodation },
    returnTicket: { ...fields.returnTicket },
  };
}

function shouldPromoteField(current: SilaAdvisorField, incoming: SilaAdvisorField) {
  if (!incoming.value) return false;
  if (!current.value) return true;
  if (incoming.value === current.value) return false;
  if (incoming.provenance === "USER_STATED" && current.provenance !== "USER_STATED") return true;
  return incoming.confidence > current.confidence + 0.12;
}

export function createSilaTravelCase(message: string, now = new Date()): SilaTravelCaseSnapshot {
  const intent = extractSilaAdvisorIntent(message);
  return {
    id: makeCaseId(intent, now),
    title: summarizeSilaAdvisorUnderstanding(intent),
    role: intent.role,
    fields: cloneFields(intent.fields),
    messages: [
      {
        id: makeMessageId(now, 0),
        text: intent.originalMessage,
        role: intent.role,
        capturedAt: now.toISOString(),
      },
    ],
    changes: FIELD_KEYS
      .filter((field) => Boolean(intent.fields[field].value))
      .map((field) => ({
        field,
        previousValue: null,
        nextValue: intent.fields[field].value as string,
        provenance: intent.fields[field].provenance,
      })),
    updatedAt: now.toISOString(),
  };
}

export function mergeSilaTravelCaseMessage(
  current: SilaTravelCaseSnapshot,
  message: string,
  now = new Date(),
): SilaTravelCaseSnapshot {
  const intent = extractSilaAdvisorIntent(message);
  const fields = cloneFields(current.fields);
  const changes: SilaTravelCaseChange[] = [];

  for (const field of FIELD_KEYS) {
    const incoming = intent.fields[field];
    const existing = fields[field];
    if (!shouldPromoteField(existing, incoming)) continue;
    changes.push({
      field,
      previousValue: existing.value,
      nextValue: incoming.value as string,
      provenance: incoming.provenance,
    });
    fields[field] = { ...incoming };
  }

  const mergedIntent: SilaAdvisorIntentDraft = {
    originalMessage: message.trim(),
    role: current.role !== "UNKNOWN" ? current.role : intent.role,
    fields,
  };

  return {
    ...current,
    title: summarizeSilaAdvisorUnderstanding(mergedIntent),
    role: mergedIntent.role,
    fields,
    messages: [
      ...current.messages,
      {
        id: makeMessageId(now, current.messages.length),
        text: intent.originalMessage,
        role: intent.role,
        capturedAt: now.toISOString(),
      },
    ],
    changes,
    updatedAt: now.toISOString(),
  };
}

export function summarizeSilaTravelCase(caseSnapshot: SilaTravelCaseSnapshot) {
  const intent: SilaAdvisorIntentDraft = {
    originalMessage: caseSnapshot.messages.at(-1)?.text ?? "",
    role: caseSnapshot.role,
    fields: caseSnapshot.fields,
  };
  return {
    understanding: summarizeSilaAdvisorUnderstanding(intent),
    missingQuestions: selectSilaAdvisorMissingQuestions(intent, 4),
    knownFields: FIELD_KEYS.filter((field) => Boolean(caseSnapshot.fields[field].value)).map(
      (field) => ({
        key: field,
        label: FIELD_LABELS[field],
        value: caseSnapshot.fields[field].value as string,
        provenance: caseSnapshot.fields[field].provenance,
        confidence: caseSnapshot.fields[field].confidence,
      }),
    ),
  };
}

export function serializeSilaTravelCase(caseSnapshot: SilaTravelCaseSnapshot) {
  return JSON.stringify(caseSnapshot);
}

export function parseSilaTravelCase(serialized: string | null): SilaTravelCaseSnapshot | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as SilaTravelCaseSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.id !== "string" || typeof parsed.updatedAt !== "string") return null;
    if (!parsed.fields || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}
