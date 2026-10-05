export async function accountAction(
  url: string,
  init: RequestInit,
  fallback: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      throw new Error(fallback);
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error(fallback);
    if (!response.ok)
      throw new Error(typeof data.error === "string" ? data.error : fallback);
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("الطلب استغرق وقتًا أطول من المتوقع. حاول مرة أخرى.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
