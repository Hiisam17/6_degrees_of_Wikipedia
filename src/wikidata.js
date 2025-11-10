// src/wikidata.js
import axios from "axios";
import NodeCache from "node-cache";
import pLimit from "p-limit";

const WIKI_API = process.env.WIKI_API || "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API =
  process.env.WIKIDATA_API || "https://www.wikidata.org/w/api.php";

const cacheWb = new NodeCache({
  stdTTL: Number(process.env.CACHE_TTL_WIKIBASE || 86400),
});
const cacheIsPerson = new NodeCache({
  stdTTL: Number(process.env.CACHE_TTL_ISPERSON || 86400),
});

const CHUNK = Number(process.env.CHUNK_SIZE || 50);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const limit = pLimit(CONCURRENCY);

/**
 * getWikibaseItemsBulk(titles: string[])
 * returns Map title -> qid|null
 */
export async function getWikibaseItemsBulk(titles = []) {
  const out = {};
  // ensure unique
  const uniq = Array.from(new Set(titles));
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK);
    // determine which titles are missing in cache
    const toFetch = chunk.filter((t) => cacheWb.get(`wb:${t}`) === undefined);
    if (toFetch.length > 0) {
      // MediaWiki supports multiple titles separated by |
      const params = new URLSearchParams({
        action: "query",
        titles: toFetch.join("|"),
        prop: "pageprops",
        format: "json",
      });
      const url = `${WIKI_API}?${params.toString()}`;
      try {
        const r = await axios.get(url, { timeout: 15000 });
        const pages = r.data.query?.pages ?? {};
        for (const p of Object.values(pages)) {
          const title = p.title;
          const qid = p?.pageprops?.wikibase_item || null;
          cacheWb.set(`wb:${title}`, qid);
        }
      } catch (err) {
        // On failure, set null for fetched ones to avoid infinite re-fetching loops
        for (const t of toFetch) cacheWb.set(`wb:${t}`, null);
        console.warn(
          `[wikidata] getWikibaseItemsBulk fetch error: ${err.message}`
        );
      }
    }
    // assemble output
    for (const t of chunk) out[t] = cacheWb.get(`wb:${t}`) ?? null;
  }
  return out; // object map title->qid|null
}

/**
 * isPersonBulk(qids: string[])
 * returns Map qid -> boolean
 */
export async function isPersonBulk(qids = []) {
  const out = {};
  const uniq = Array.from(new Set(qids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK);
    const toFetch = chunk.filter(
      (q) => cacheIsPerson.get(`person:${q}`) === undefined
    );
    if (toFetch.length > 0) {
      // wbgetentities supports multiple ids with | separator
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: toFetch.join("|"),
        props: "claims",
        format: "json",
      });
      const url = `${WIKIDATA_API}?${params.toString()}`;
      try {
        const r = await axios.get(url, { timeout: 15000 });
        const entities = r.data.entities || {};
        for (const q of toFetch) {
          const ent = entities[q] || {};
          const p31 = ent?.claims?.P31 ?? [];
          const isPerson = p31.some(
            (c) => c.mainsnak?.datavalue?.value?.id === "Q5"
          );
          cacheIsPerson.set(`person:${q}`, isPerson);
        }
      } catch (err) {
        // on error assume false but cache as false to avoid retrigger (or you can skip caching)
        for (const q of toFetch) cacheIsPerson.set(`person:${q}`, false);
        console.warn(`[wikidata] isPersonBulk fetch error: ${err.message}`);
      }
    }
    for (const q of chunk) out[q] = cacheIsPerson.get(`person:${q}`) ?? false;
  }
  return out; // object map qid->bool
}

/**
 * Helper: get isPerson for a bunch of titles (titles -> qid -> isPerson)
 * returns map title -> boolean
 */
export async function titlesArePerson(titles = []) {
  const titleToQid = await getWikibaseItemsBulk(titles);
  const qids = Object.values(titleToQid).filter(Boolean);
  const qidMap = await isPersonBulk(qids);
  const out = {};
  for (const t of titles) {
    const q = titleToQid[t];
    out[t] = q ? qidMap[q] === true : false;
  }
  return out; // title -> bool
}

export default { getWikibaseItemsBulk, isPersonBulk, titlesArePerson };
