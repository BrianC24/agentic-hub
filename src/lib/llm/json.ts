/**
 * Extracts JSON from a model response.
 *
 * Models routinely wrap JSON in a ```json fence despite being told not to.
 * That is a formatting habit rather than a contract violation, so it is
 * tolerated here rather than burning a repair round on it.
 */
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}
