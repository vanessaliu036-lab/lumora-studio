// Vercel serverless: a single Lumora blog article at /blog/:slug, sourced from Airtable
// "Lumora｜文章正文". Server-rendered as HTML by default (real <title>/description/canonical
// tags + JSON-LD) so articles are crawlable without a build step; add ?format=json for raw data.
import {
  PUBLISHED_STATUS,
  toArticleSummary,
  toArticleDetail,
  dedupeSlugs,
  escapeHtml,
  bodyToHtmlParagraphs,
  buildExcerpt,
} from '../../lib/blog-content.mjs';
import { renderShell, SITE_ORIGIN } from '../../lib/blog-layout.mjs';
import { fetchPublishedArticles } from '../../lib/blog-source.mjs';

const PAT = process.env.AIRTABLE_PAT;

async function findArticleBySlug(slug) {
  const { articles, planByPath } = await fetchPublishedArticles(PAT, PUBLISHED_STATUS);
  const summaries = dedupeSlugs(articles.map(r => toArticleSummary(r, planByPath)));
  const index = summaries.findIndex(a => a.slug === slug);
  if (index === -1) return null;
  const record = articles[index];
  const planFields = planByPath[record.fields['網址路徑'] || ''] || {};
  const detail = toArticleDetail(record, planFields);
  detail.slug = summaries[index].slug; // keep in sync with any dedupe suffix
  return detail;
}

function renderNotFound() {
  const bodyHtml = `<header class="head">
  <div class="kicker">404</div>
  <h1>Article not <span>found</span>.</h1>
  <p>This story may have moved, or hasn't been published yet.</p>
  <p><a class="back-link" href="/blog" style="margin:0">← Back to the Journal</a></p>
</header>`;
  return renderShell({
    title: 'Article not found — Lumora Journal',
    description: 'This article may have moved or has not been published yet.',
    canonical: `${SITE_ORIGIN}/blog`,
    bodyHtml,
  });
}

function renderArticle(article) {
  const publishedLabel = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const bodyHtml = `<a class="back-link" href="/blog">← All articles</a>
<header class="head">
  <div class="kicker">${escapeHtml(article.category || 'Article')}</div>
  <h1>${escapeHtml(article.title)}</h1>
  <div class="article-meta">
    <span>${article.readMinutes} min read</span>
    <span>${article.wordCount || 0} words</span>
    ${publishedLabel ? `<span>${escapeHtml(publishedLabel)}</span>` : ''}
  </div>
</header>
<article class="prose">
${bodyToHtmlParagraphs(article.body)}
</article>`;

  const description = buildExcerpt(article.body, 160) || article.keyword || article.title;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description,
    wordCount: article.wordCount || undefined,
    datePublished: article.publishedAt || undefined,
    author: { '@type': 'Organization', name: 'Lumora Studio' },
    publisher: { '@type': 'Organization', name: 'Lumora Studio' },
  });

  return renderShell({
    title: `${article.title} — Lumora Journal`,
    description,
    canonical: `${SITE_ORIGIN}/blog/${article.slug}`,
    jsonLd,
    bodyHtml,
  });
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').trim();
  const wantsJson = String(req.query.format || '').toLowerCase() === 'json';
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!PAT) {
    res.statusCode = 500;
    return wantsJson
      ? res.json({ ok: false, error: 'AIRTABLE_PAT is not configured' })
      : res.send('AIRTABLE_PAT is not configured');
  }
  if (!slug) {
    res.statusCode = 400;
    return wantsJson ? res.json({ ok: false, error: 'slug is required' }) : res.send('Missing article slug');
  }
  try {
    const article = await findArticleBySlug(slug);
    if (!article) {
      res.statusCode = 404;
      if (wantsJson) return res.json({ ok: false, error: 'Article not found' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderNotFound());
    }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
    if (wantsJson) {
      res.statusCode = 200;
      return res.json({ ok: true, article });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    return res.send(renderArticle(article));
  } catch (e) {
    res.statusCode = 500;
    if (wantsJson) return res.json({ ok: false, error: String(e.message || e) });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(`Failed to load article: ${String(e.message || e)}`);
  }
}
