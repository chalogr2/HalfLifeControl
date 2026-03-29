/**
 * openFDA Drug Label API client.
 * Used as a fallback when a drug isn't in the curated database.
 * Returns generic name + brand name for typeahead suggestions.
 *
 * API docs: https://open.fda.gov/apis/drug/label/
 * No API key required (rate limit: 240 req/min without key).
 */

const BASE_URL = 'https://api.fda.gov/drug/label.json';

/** Simple in-memory cache to avoid re-fetching the same query. */
const cache = new Map<string, OpenFDAResult[]>();

export interface OpenFDAResult {
  /** Generic drug name. */
  genericName: string;
  /** Brand name (if available). */
  brandName: string;
}

/**
 * Search openFDA for drug names matching a query.
 * Returns up to `limit` results.
 */
export async function searchOpenFDA(
  query: string,
  limit: number = 10,
): Promise<OpenFDAResult[]> {
  if (!query || query.length < 3) return [];

  const cacheKey = `${query.toLowerCase()}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const encoded = encodeURIComponent(query);
    const url = `${BASE_URL}?search=openfda.generic_name:"${encoded}"+openfda.brand_name:"${encoded}"&limit=${limit}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      // 404 = no results, not an error
      if (res.status === 404) return [];
      return [];
    }

    const data = await res.json();
    const results: OpenFDAResult[] = [];
    const seen = new Set<string>();

    for (const item of data.results ?? []) {
      const generic = item.openfda?.generic_name?.[0] ?? '';
      const brand = item.openfda?.brand_name?.[0] ?? '';

      if (!generic && !brand) continue;

      const key = generic.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        genericName: generic,
        brandName: brand,
      });
    }

    cache.set(cacheKey, results);
    return results;
  } catch {
    // Network error, timeout, etc. — silently return empty
    return [];
  }
}

/** Clear the openFDA cache (useful for testing). */
export function clearOpenFDACache(): void {
  cache.clear();
}
