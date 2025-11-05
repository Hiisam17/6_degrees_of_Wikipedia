import axios from "axios";
import NodeCache from "node-cache";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
export const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

/**
 * getLinks(title)
 * - returns Array of linked titles (namespace 0)
 * - uses cache key 'links:<title>'
 */
export async function getLinks(title) {
  const key = `links:${title}`;
  const cached = cache.get(key);
  if (cached) {
    console.debug(`[cache] hit ${key}`);
    return cached;
  }
  console.debug(`[cache] miss ${key} -> calling Wikipedia`);

  const results = new Set();
  let params = {
    action: "query",
    prop: "links",
    titles: title,
    plnamespace: 0,
    pllimit: "max",
    format: "json",
  };

  try {
    while (true) {
      const url = `${WIKI_API}?${new URLSearchParams(params).toString()}`;
      console.debug(`[wiki] GET ${url}`);
      const r = await axios.get(url, { timeout: 20000 });
      const j = r.data;
      for (const p of Object.values(j.query?.pages ?? {})) {
        for (const l of p.links ?? []) {
          results.add(l.title);
        }
      }
      if (j.continue) {
        params = { ...params, ...j.continue };
      } else break;
    }
  } catch (err) {
    console.warn(`[wiki] getLinks(${title}) error: ${err.message}`);
    throw err;
  }

  const arr = Array.from(results);
  cache.set(key, arr);
  return arr;
}
