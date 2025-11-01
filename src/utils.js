// src/utils.js
import axios from "axios";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/**
 * Normalize title:
 * - trim whitespace
 * - collapse internal spaces to '_'
 * - Capitalize first char (convention)
 */
export function normalizeTitle(title) {
  if (!title || typeof title !== "string") return "";
  let t = title
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) // capitalize first letter of each word
    .replace(/\s+/g, "_"); // replace spaces with underscores
  return t;
}

/**
 * resolveRedirect(title)
 * - call MediaWiki API with redirects=1
 * - return canonical title or null if page missing
 */
export async function resolveRedirect(title) {
  try {
    const params = new URLSearchParams({
      action: "query",
      titles: title,
      redirects: "1",
      format: "json",
    });
    const url = `${WIKI_API}?${params.toString()}`;
    const r = await axios.get(url, { timeout: 10000 });
    const pages = r.data.query?.pages ?? {};
    const p = Object.values(pages)[0];
    if (!p || p.missing) return null;
    return p.title;
  } catch (err) {
    // propagate error to caller
    throw err;
  }
}
