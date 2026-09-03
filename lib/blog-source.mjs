// Airtable data access for the Lumora blog. Talks to base appOLY56Y7cNExxzs:
// "Lumora｜文章正文" (article body) and "Lumora｜SEO 規劃" (SEO plan, for title/keyword
// fallbacks). The Airtable PAT must be supplied by the caller (server-side env var only).
const BASE = 'appOLY56Y7cNExxzs';
const ARTICLES_TABLE = 'tblm3zmq83xyIXSqT';
const SEO_PLAN_TABLE = 'tblQ7MHHaJ9PhAHyC';
const API = `https://api.airtable.com/v0/${BASE}`;

async function atList(pat, table, formula = '', max = 100) {
  const url = new URL(`${API}/${table}`);
  url.searchParams.set('pageSize', String(max));
  if (formula) url.searchParams.set('filterByFormula', formula);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
  if (!r.ok) throw new Error(`Airtable ${table}: ${r.status} ${await r.text()}`);
  return (await r.json()).records || [];
}

// Returns published article records plus a lookup of SEO-plan fields keyed by 網址路徑.
export async function fetchPublishedArticles(pat, publishedStatus) {
  const [articles, plans] = await Promise.all([
    atList(pat, ARTICLES_TABLE, `{狀態}='${publishedStatus}'`, 100),
    atList(pat, SEO_PLAN_TABLE, '', 100),
  ]);
  const planByPath = Object.fromEntries(
    plans.filter(p => p.fields['網址路徑']).map(p => [p.fields['網址路徑'], p.fields])
  );
  return { articles, planByPath };
}
