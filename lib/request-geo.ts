/**
 * Extract IP address and geographic info from Vercel request headers.
 * Vercel automatically injects these headers on every incoming request.
 * Returns nulls when running locally (headers won't be present).
 */
export function getRequestGeo(request: Request) {
  const headers = request.headers;
  return {
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    city: headers.get("x-vercel-ip-city") || null,
    region: headers.get("x-vercel-ip-country-region") || null,
    country: headers.get("x-vercel-ip-country") || null,
  };
}
