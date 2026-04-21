/**
 * Extract IP address and geographic info from request headers.
 *
 * Supports both Vercel (`x-vercel-ip-*`) and Cloudflare (`cf-*`) header
 * conventions so the same code runs on either platform during a migration.
 * Returns nulls when running locally (headers won't be present), or when the
 * underlying platform/tier doesn't expose a particular field (e.g. Cloudflare
 * city/region require Business+).
 */
export function getRequestGeo(request: Request) {
  const headers = request.headers;
  return {
    ip:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("cf-connecting-ip") ||
      null,
    city:
      headers.get("x-vercel-ip-city") ||
      headers.get("cf-ipcity") ||
      null,
    region:
      headers.get("x-vercel-ip-country-region") ||
      headers.get("cf-region-code") ||
      headers.get("cf-region") ||
      null,
    country:
      headers.get("x-vercel-ip-country") ||
      headers.get("cf-ipcountry") ||
      null,
  };
}
