/**
 * Spec-to-issue lineage markers.
 *
 * IngestionService prepends a single-line HTML comment to every created
 * issue body so the spec-side ref (`T-001`, `capability:Foo`) can be
 * recovered from the issue later. Audit pipelines use this to compute
 * spec-orphan metrics for AI-closed work.
 *
 * Marker shape:
 *   <!-- ido4-lineage: ref=T-001 -->
 *
 * The marker is placed at the TOP of the body. Parsers tolerate
 * surrounding whitespace and locate the first marker if multiple exist
 * (multiple shouldn't happen, but lineage is informational, not
 * authoritative — defensive parsing is cheap).
 */

const LINEAGE_PATTERN = /<!--\s*ido4-lineage:\s*ref=([^\s>-]+(?:[^\s>]*[^\s>-])?)\s*-->/;

/**
 * Build a lineage-marker comment for a given spec ref.
 *
 * Returns the marker line only (no trailing newline) so callers can
 * decide their own join strategy.
 */
export function formatIdo4LineageMarker(ref: string): string {
  return `<!-- ido4-lineage: ref=${ref} -->`;
}

/**
 * Build a body string with the lineage marker prepended above existing content.
 *
 * If `body` is empty, returns the marker alone. Idempotent: re-applying with
 * the same ref to a body that already starts with that marker is a no-op.
 */
export function withLineageMarker(ref: string, body: string): string {
  const marker = formatIdo4LineageMarker(ref);
  if (body.startsWith(marker)) return body;
  return body.length > 0 ? `${marker}\n\n${body}` : marker;
}

/**
 * Recover the spec ref from an issue body, or `null` if the body has no
 * lineage marker.
 *
 * Capability refs follow the convention `capability:<name>`; task refs
 * follow whatever the spec used (e.g., `T-001`, `INFRA-02`). The parser
 * doesn't validate ref shape — that's the spec parser's job upstream.
 */
export function parseIdo4LineageMarker(body: string): { ref: string | null } {
  const match = body.match(LINEAGE_PATTERN);
  return { ref: match ? match[1]! : null };
}
