export function readRecoveryLink(href: string): string {
  const url = new URL(href);
  const token = new URLSearchParams(url.hash.slice(1)).get("token") ?? url.searchParams.get("token") ?? "";
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}

export function consumeRecoveryLink(location: Pick<Location, "href" | "pathname">, history: Pick<History, "replaceState" | "state">): string {
  const url = new URL(location.href);
  const token = readRecoveryLink(location.href);
  // Fragments never reach the HTTP server. Scrub legacy query links too, before
  // the next navigation; keep Next's history state intact.
  if (url.hash || url.search) history.replaceState(history.state, "", location.pathname);
  return token;
}
