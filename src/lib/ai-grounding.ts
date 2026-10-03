function urls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(matches.map((value) => value.replace(/[.,;:!?]+$/, "")))];
}

export function groundSynthesis(params: {
  answer: string;
  untrustedWebContext: string;
}): {
  answer: string;
  sourcesUsed: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
} {
  const allowed = new Set(urls(params.untrustedWebContext));
  const cited = urls(params.answer).filter((url) => allowed.has(url));

  return {
    answer: params.answer,
    sourcesUsed: [...new Set(cited)],
    // Untrusted web excerpts + an LLM synthesis are never sufficient for HIGH.
    confidence: cited.length >= 2 ? "MEDIUM" : "LOW",
  };
}
