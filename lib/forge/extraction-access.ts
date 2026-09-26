// Development convenience is restricted to same-origin loopback requests.
export function isLocalExtractionRequest(
  environment: string | undefined,
  host: string | null,
  origin: string | null,
) {
  if (environment !== "development" || !host || !origin) return false;
  try {
    const url = new URL(origin);
    return (
      url.host === host &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedExtractionUser(
  userId: string | undefined,
  allowlist: string | undefined,
) {
  return (
    !!userId &&
    (allowlist ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .includes(userId)
  );
}

// Per-process prototype cap. A shared durable limiter is needed before scaling to multiple instances.
export function createExtractionLimiter() {
  let count = 0,
    active = 0,
    resetAt = 0;
  return (now = Date.now()) => {
    if (active >= 2)
      throw new Error(
        "Two extractions are already running. Try again shortly.",
      );
    if (now >= resetAt) {
      count = 0;
      resetAt = now + 60 * 60 * 1000;
    }
    if (count >= 20)
      throw new Error(
        "This prototype has reached its 20 requests per hour limit. Try again later.",
      );
    count++;
    active++;
    let released = false;
    return () => {
      if (!released) {
        active--;
        released = true;
      }
    };
  };
}
