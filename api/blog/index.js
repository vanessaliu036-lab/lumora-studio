// Vercel serverless: Lumora blog index, sourced from Airtable "Lumora｜文章正文"
// (article body) cross-referenced with "Lumora｜SEO 規劃" (SEO plan). Server-rendered
// as HTML by default so /blog is crawlable without a build step; add ?format=json
// for the raw article list.
import {
  PUBLISHED_STATUS,
  toArticleSummary,
  dedupeSlugs,
  sortByPublishedDesc,
  escapeHtml,
} from '../../lib/blog-content.mjs';
import { renderShell, SITE_ORIGIN } from '../../lib/blog-layout.mjs';
import { fetchPublishedArticles } from '../../lib/blog-source.mjs';

const PAT = process.env.AIRTABLE_PAT;

async function loadPublishedArticleSummaries() {
  const { articles, planByPath } = await fetchPublishedArticles(PAT, PUBLISHED_STATUS);
  const summaries = articles.map(r => toArticleSummary(r, planByPath)).filter(a => a.title);
  return sortByPublishedDesc(dedupeSlugs(summaries));
}

function renderCard(article) {
  return `<a class="card" href="/blog/${encodeURIComponent(article.slug)}">
  <span class="chip">${escapeHtml(article.category || 'Article')}</span>
  <h2>${escapeHtml(article.title)}</h2>
  <p>${escapeHtml(article.excerpt)}</p>
  <span class="meta">${article.readMinutes} min read · ${article.wordCount || 0} words</span>
</a>`;
}

function renderPage(articles) {
  const body = articles.length
    ? articles.map(renderCard).join('\n')
    : '<div class="empty">New articles are on their way — check back soon.</div>';
  const bodyHtml = `<a class="back-link" href="/index.html#top">← Back to Lumora</a>
<header class="head">
  <div class="kicker">Lumora Journal</div>
  <h1>Ideas that <span>convert</span>.</h1>
  <p>Notes on AI advertising, creative production and brand storytelling — written for teams building in Cambodia and beyond.</p>
</header>
<section class="grid">
${body}
</section>`;
  return renderShell({
    title: 'Lumora Journal — AI Advertising Insights',
    description: "Lumora's journal on AI advertising, creative production and brand storytelling in Cambodia and beyond.",
    canonical: `${SITE_ORIGIN}/blog`,
    bodyHtml,
  });
}

export default async function handler(req, res) {
  const wantsJson = String(req.query.format || '').toLowerCase() === 'json';
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!PAT) {
    res.statusCode = 500;
    return wantsJson
      ? res.json({ ok: false, error: 'AIRTABLE_PAT is not configured' })
      : res.send('AIRTABLE_PAT is not configured');
  }
  try {
    const articles = await loadPublishedArticleSummaries();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
    if (wantsJson) {
      res.statusCode = 200;
      return res.json({ ok: true, count: articles.length, articles });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    return res.send(renderPage(articles));
  } catch (e) {
    res.statusCode = 500;
    if (wantsJson) return res.json({ ok: false, error: String(e.message || e) });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(`Failed to load Lumora Journal: ${String(e.message || e)}`);
  }
}
