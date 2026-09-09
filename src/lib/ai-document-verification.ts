import { privateStorageProvider } from "@/lib/private-storage";

type AgentProfile = {
  displayName: string;
  latinName: string;
  city: string;
  country: string;
  licenseType: string;
  licenseNumber: string | null;
  email: string;
};

type DocumentInput = {
  id: number;
  documentType: string;
  originalName: string;
  storageKey: string;
};

export type AIVerificationResult = {
  overallConfidence: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "pass" | "review" | "reject";
  summary: string;
  profileChecks: {
    nameMatch: "match" | "partial" | "mismatch" | "not_available";
    addressMatch: "match" | "partial" | "mismatch" | "not_available";
    licenseMatch: "match" | "partial" | "mismatch" | "not_available";
  };
  documents: Array<{
    documentId: number;
    documentType: string;
    classification: "match" | "unclear" | "mismatch";
    quality: "high" | "medium" | "low";
    extracted: {
      fullName: string | null;
      latinName: string | null;
      documentNumber: string | null;
      address: string | null;
      issuingAuthority: string | null;
      issueDate: string | null;
      expiryDate: string | null;
      licenseNumber: string | null;
    };
    validity: "valid" | "expired" | "unclear" | "not_applicable";
    tamperRisk: "low" | "medium" | "high" | "unclear";
    reasons: string[];
  }>;
  warnings: string[];
};

const enabled = process.env.AI_DOCUMENT_REVIEW_ENABLED === "true";
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_DOCUMENT_REVIEW_MODEL || "gpt-5.6-luna";

export function aiDocumentReviewConfigured(): boolean {
  return enabled && Boolean(apiKey);
}

const resultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overallConfidence", "riskLevel", "recommendation", "summary", "profileChecks", "documents", "warnings"],
  properties: {
    overallConfidence: { type: "number", minimum: 0, maximum: 100 },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    recommendation: { type: "string", enum: ["pass", "review", "reject"] },
    summary: { type: "string" },
    profileChecks: {
      type: "object",
      additionalProperties: false,
      required: ["nameMatch", "addressMatch", "licenseMatch"],
      properties: {
        nameMatch: { type: "string", enum: ["match", "partial", "mismatch", "not_available"] },
        addressMatch: { type: "string", enum: ["match", "partial", "mismatch", "not_available"] },
        licenseMatch: { type: "string", enum: ["match", "partial", "mismatch", "not_available"] },
      },
    },
    documents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["documentId", "documentType", "classification", "quality", "extracted", "validity", "tamperRisk", "reasons"],
        properties: {
          documentId: { type: "integer" },
          documentType: { type: "string" },
          classification: { type: "string", enum: ["match", "unclear", "mismatch"] },
          quality: { type: "string", enum: ["high", "medium", "low"] },
          extracted: {
            type: "object",
            additionalProperties: false,
            required: ["fullName", "latinName", "documentNumber", "address", "issuingAuthority", "issueDate", "expiryDate", "licenseNumber"],
            properties: {
              fullName: { type: ["string", "null"] },
              latinName: { type: ["string", "null"] },
              documentNumber: { type: ["string", "null"] },
              address: { type: ["string", "null"] },
              issuingAuthority: { type: ["string", "null"] },
              issueDate: { type: ["string", "null"] },
              expiryDate: { type: ["string", "null"] },
              licenseNumber: { type: ["string", "null"] },
            },
          },
          validity: { type: "string", enum: ["valid", "expired", "unclear", "not_applicable"] },
          tamperRisk: { type: "string", enum: ["low", "medium", "high", "unclear"] },
          reasons: { type: "array", items: { type: "string" } },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

async function uploadToOpenAI(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([buffer], { type: contentType }), filename);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`AI file upload failed (${response.status})`);
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("AI file upload returned no file id");
  return data.id;
}

async function deleteOpenAIFile(fileId: string): Promise<void> {
  await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => undefined);
}

export async function analyzeAgentDocuments(
  agent: AgentProfile,
  documents: DocumentInput[],
): Promise<AIVerificationResult> {
  if (!aiDocumentReviewConfigured()) {
    throw new Error("AI document review is not enabled");
  }
  if (!documents.length) throw new Error("No verification documents available");
  if (documents.length > 4) throw new Error("Too many documents for one verification run");

  const uploaded: string[] = [];
  try {
    const inputs: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: [
          "You are the AI evidence-analysis layer for THE JOURNEY travel-agent trust system.",
          "Analyze the supplied verification documents against the supplied agent profile.",
          "Extract visible facts, compare them, identify inconsistencies, and flag possible tampering signals.",
          "Do not claim legal authenticity or government verification. You only provide evidence analysis and risk signals.",
          "A phone number cannot be considered verified from a document; phone ownership requires a separate OTP flow.",
          "Address differences are not automatic fraud: use partial/mismatch and explain the reason.",
          "Never invent a value that is not legible or present; use null or not_available.",
          `Agent profile: ${JSON.stringify({
            displayName: agent.displayName,
            latinName: agent.latinName,
            city: agent.city,
            country: agent.country,
            licenseType: agent.licenseType,
            licenseNumber: agent.licenseNumber,
            email: agent.email,
          })}`,
          `Expected document types: ${documents.map((d) => `${d.id}:${d.documentType}`).join(", ")}`,
        ].join("\n"),
      },
    ];

    for (const document of documents) {
      const signed = await privateStorageProvider.getPresignedDownloadUrl(document.storageKey, 300);
      const fileResponse = await fetch(signed.downloadUrl, { cache: "no-store" });
      if (!fileResponse.ok) throw new Error(`Unable to read private document ${document.id}`);
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      if (buffer.byteLength > 10 * 1024 * 1024) throw new Error(`Document ${document.id} exceeds the allowed size`);
      const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
      const fileId = await uploadToOpenAI(buffer, document.originalName, contentType);
      uploaded.push(fileId);
      inputs.push({ type: "input_file", file_id: fileId, filename: document.originalName });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        input: [{ role: "user", content: inputs }],
        text: {
          format: {
            type: "json_schema",
            name: "journey_agent_verification",
            strict: true,
            schema: resultSchema,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`AI verification failed (${response.status})`);

    const data = (await response.json()) as { output_text?: string };
    if (!data.output_text) throw new Error("AI verification returned no structured result");
    const parsed = JSON.parse(data.output_text) as AIVerificationResult;
    return parsed;
  } finally {
    await Promise.all(uploaded.map(deleteOpenAIFile));
  }
}
