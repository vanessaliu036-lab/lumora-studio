// Vercel serverless: XML sitemap listing the static pages plus every published Lumora
// Journal article, so new Airtable-sourced articles are discoverable without a manual
// sitemap update. Served at /sitemap.xml via the vercel.json rewrite.
import { PUBLISHED_STATUS, toArticleSummary, dedupeSlugs, escapeHtml } from '../lib/blog-content.mjs';
import { SITE_ORIGIN } from '../lib/blog-layout.mjs';
import { fetchPublishedArticles } from '../lib/blog-source.mjs';

const PAT = process.env.AIRTABLE_PAT;

const STATIC_PATHS = ['/', '/ai-team', '/ai-twin', '/seo-web', '/blog', '/white-label.html', '/lamura-os.html', '/images.html'];

function urlEntry(loc, lastmod) {
  const lastmodTag = lastmod ? `\n    <lastmod>${escapeHtml(lastmod.slice(0, 10))}</lastmod>` : '';
  return `  <url>\n    <loc>${escapeHtml(loc)}</loc>${lastmodTag}\n  </url>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  try {
    let articles = [];
    if (PAT) {
      const { articles: records, planByPath } = await fetchPublishedArticles(PAT, PUBLISHED_STATUS);
      articles = dedupeSlugs(records.map(r => toArticleSummary(r, planByPath))).filter(a => a.title);
    }
    const staticEntries = STATIC_PATHS.map(path => urlEntry(`${SITE_ORIGIN}${path}`));
    const articleEntries = articles.map(a => urlEntry(`${SITE_ORIGIN}/blog/${a.slug}`, a.publishedAt));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...articleEntries].join('\n')}\n</urlset>`;
    res.statusCode = 200;
    return res.send(xml);
  } catch (e) {
    // Fall back to the static pages only, so a transient Airtable error never breaks the sitemap.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${STATIC_PATHS.map(path => urlEntry(`${SITE_ORIGIN}${path}`)).join('\n')}\n</urlset>`;
    res.statusCode = 200;
    return res.send(xml);
  }
}
