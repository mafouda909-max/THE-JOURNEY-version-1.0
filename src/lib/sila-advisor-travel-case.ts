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

export interface SilaTravelerProfile {
  nationality: string | null;
  homeOrigin: string | null;
  familyContext: string | null;
  budgetStyle: string | null;
  preferredDestinations: string[];
  interests: string[];
  constraints: string[];
  lastUpdatedAt: string;
}

export interface SilaAgentProfile {
  hasAgentIntent: boolean;
  handledDestinations: string[];
  clientSegments: string[];
  requestedBriefs: number;
  lastUpdatedAt: string;
}

export interface SilaTravelPreferenceMemory {
  priceSensitivity: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH";
  familyFriendly: boolean;
  transitConcern: boolean;
  comfortSignals: string[];
  destinationHistory: string[];
}

export interface SilaAdvisorMemoryGraph {
  traveler: SilaTravelerProfile;
  agent: SilaAgentProfile;
  preferences: SilaTravelPreferenceMemory;
}

export interface SilaTravelCaseSnapshot {
  id: string;
  title: string;
  role: SilaAdvisorRole;
  fields: SilaAdvisorIntentDraft["fields"];
  memory: SilaAdvisorMemoryGraph;
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

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function detectInterests(message: string) {
  const interests: string[] = [];
  if (/عائلي|عيلة|طفل|طفلة|أطفال|اولاد|أولاد|بيبي/.test(message)) interests.push("سفر عائلي");
  if (/رخيص|اقتصادي|ميزانية|توفير|ارخص|أرخص/.test(message)) interests.push("توفير في التكلفة");
  if (/راحة|مريح|فندق كويس|قريب|بدون تعب/.test(message)) interests.push("راحة أعلى");
  if (/ترانزيت|توقف|مطار|layover|transit/i.test(message)) interests.push("تقليل مخاطر الترانزيت");
  if (/فيزا|تأشيرة|سفارة|ملف/.test(message)) interests.push("تجهيز ملف التأشيرة");
  return interests;
}

function detectConstraints(message: string) {
  const constraints: string[] = [];
  if (/ميزانية\s*(?:محدودة|قليلة)|اقتصادي|ارخص|أرخص/.test(message)) constraints.push("ميزانية محدودة");
  if (/طفل|طفلة|أطفال|اولاد|أولاد|بيبي/.test(message)) constraints.push("مناسب لطفل/أسرة");
  if (/مش عارف|محتار|أبدأ منين|ابدأ منين/.test(message)) constraints.push("يحتاج توجيه خطوة بخطوة");
  if (/ترانزيت|توقف/.test(message)) constraints.push("تأكيد الترانزيت مهم");
  return constraints;
}

function priceSensitivityFrom(message: string): SilaTravelPreferenceMemory["priceSensitivity"] {
  if (/ميزانية\s*(?:محدودة|قليلة)|اقتصادي|ارخص|أرخص|توفير/.test(message)) return "HIGH";
  if (/سعر مناسب|متوسط/.test(message)) return "MEDIUM";
  if (/راحة|فاخر|فخم|خمس نجوم/.test(message)) return "LOW";
  return "UNKNOWN";
}

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

function createMemoryGraph(intent: SilaAdvisorIntentDraft, now: Date): SilaAdvisorMemoryGraph {
  const message = intent.originalMessage;
  const destination = intent.fields.destination.value;
  const familyContext = /طفل|طفلة|أطفال|اولاد|أولاد|بيبي|مراتي|زوجتي|زوج/.test(message)
    ? intent.fields.travelers.value
    : null;
  const interests = detectInterests(message);
  const constraints = detectConstraints(message);
  const priceSensitivity = priceSensitivityFrom(message);
  const isAgent = intent.role === "AGENT";

  return {
    traveler: {
      nationality: intent.fields.nationality.value,
      homeOrigin: intent.fields.origin.value,
      familyContext,
      budgetStyle: intent.fields.budget.value,
      preferredDestinations: uniqueValues([destination]),
      interests,
      constraints,
      lastUpdatedAt: now.toISOString(),
    },
    agent: {
      hasAgentIntent: isAgent,
      handledDestinations: isAgent ? uniqueValues([destination]) : [],
      clientSegments: isAgent ? uniqueValues([familyContext, intent.fields.budget.value]) : [],
      requestedBriefs: isAgent ? 1 : 0,
      lastUpdatedAt: now.toISOString(),
    },
    preferences: {
      priceSensitivity,
      familyFriendly: Boolean(familyContext),
      transitConcern: Boolean(intent.fields.transit.value) || /ترانزيت|توقف/.test(message),
      comfortSignals: uniqueValues(interests.filter((interest) => interest.includes("راحة"))),
      destinationHistory: uniqueValues([destination]),
    },
  };
}

function mergeMemoryGraph(
  current: SilaAdvisorMemoryGraph,
  intent: SilaAdvisorIntentDraft,
  now: Date,
): SilaAdvisorMemoryGraph {
  const incoming = createMemoryGraph(intent, now);
  const message = intent.originalMessage;
  const nextPriceSensitivity = priceSensitivityFrom(message);

  return {
    traveler: {
      nationality: incoming.traveler.nationality ?? current.traveler.nationality,
      homeOrigin: incoming.traveler.homeOrigin ?? current.traveler.homeOrigin,
      familyContext: incoming.traveler.familyContext ?? current.traveler.familyContext,
      budgetStyle: incoming.traveler.budgetStyle ?? current.traveler.budgetStyle,
      preferredDestinations: uniqueValues([
        ...current.traveler.preferredDestinations,
        ...incoming.traveler.preferredDestinations,
      ]),
      interests: uniqueValues([...current.traveler.interests, ...incoming.traveler.interests]),
      constraints: uniqueValues([...current.traveler.constraints, ...incoming.traveler.constraints]),
      lastUpdatedAt: now.toISOString(),
    },
    agent: {
      hasAgentIntent: current.agent.hasAgentIntent || incoming.agent.hasAgentIntent,
      handledDestinations: uniqueValues([
        ...current.agent.handledDestinations,
        ...incoming.agent.handledDestinations,
      ]),
      clientSegments: uniqueValues([...current.agent.clientSegments, ...incoming.agent.clientSegments]),
      requestedBriefs: current.agent.requestedBriefs + incoming.agent.requestedBriefs,
      lastUpdatedAt: now.toISOString(),
    },
    preferences: {
      priceSensitivity:
        nextPriceSensitivity !== "UNKNOWN" ? nextPriceSensitivity : current.preferences.priceSensitivity,
      familyFriendly: current.preferences.familyFriendly || incoming.preferences.familyFriendly,
      transitConcern: current.preferences.transitConcern || incoming.preferences.transitConcern,
      comfortSignals: uniqueValues([
        ...current.preferences.comfortSignals,
        ...incoming.preferences.comfortSignals,
      ]),
      destinationHistory: uniqueValues([
        ...current.preferences.destinationHistory,
        ...incoming.preferences.destinationHistory,
      ]),
    },
  };
}

export function createSilaTravelCase(message: string, now = new Date()): SilaTravelCaseSnapshot {
  const intent = extractSilaAdvisorIntent(message);
  return {
    id: makeCaseId(intent, now),
    title: summarizeSilaAdvisorUnderstanding(intent),
    role: intent.role,
    fields: cloneFields(intent.fields),
    memory: createMemoryGraph(intent, now),
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
    memory: mergeMemoryGraph(current.memory, intent, now),
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
    profileSignals: {
      travelerInterests: caseSnapshot.memory.traveler.interests,
      travelerConstraints: caseSnapshot.memory.traveler.constraints,
      preferredDestinations: caseSnapshot.memory.traveler.preferredDestinations,
      destinationHistory: caseSnapshot.memory.preferences.destinationHistory,
      priceSensitivity: caseSnapshot.memory.preferences.priceSensitivity,
      agentMode: caseSnapshot.memory.agent.hasAgentIntent,
      agentHandledDestinations: caseSnapshot.memory.agent.handledDestinations,
    },
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
    if (!parsed.memory?.traveler || !parsed.memory?.agent || !parsed.memory?.preferences) return null;
    return parsed;
  } catch {
    return null;
  }
}
