// Pure helpers for turning Airtable "Lumora｜文章正文" (article body) records —
// cross-referenced with "Lumora｜SEO 規劃" (SEO plan) records — into blog view models.
// Kept framework-free so it can be unit tested without mocking the Airtable API.

const ARTICLE_FIELD = {
  title: '頁面標題',
  path: '網址路徑',
  category: '類別',
  body: '正文',
  wordCount: '字數',
  status: '狀態',
};

const PLAN_FIELD = {
  keyword: '關鍵字',
  suggestedTitle: '建議標題',
  path: '網址路徑',
  topicCluster: '主題群',
  searchIntent: '搜尋意圖',
  category: '類別',
};

export const PUBLISHED_STATUS = '已完成';

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// SEO 規劃 stores each page's eventual site path (e.g. "/industries/hotel-ai-advertising-cambodia").
// The blog lives at its own /blog/:slug, so we reuse the path's last segment as the slug
// (falling back to the title) rather than mirroring the full site path.
export function deriveSlug(articleFields) {
  const path = String(articleFields?.[ARTICLE_FIELD.path] || '').trim();
  if (path) {
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    const slug = slugify(last);
    if (slug) return slug;
  }
  return slugify(articleFields?.[ARTICLE_FIELD.title]);
}

export function buildExcerpt(body, len = 200) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= len) return text;
  const cut = text.slice(0, len).replace(/\s+\S*$/, '');
  return `${cut}…`;
}

export function estimateReadMinutes(wordCount) {
  const n = Number(wordCount) || 0;
  return Math.max(1, Math.round(n / 200));
}

export function isPublished(articleFields) {
  return articleFields?.[ARTICLE_FIELD.status] === PUBLISHED_STATUS;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

export function bodyToHtmlParagraphs(body) {
  const text = String(body || '').trim();
  if (!text) return '';
  const blocks = text.includes('\n\n') ? text.split(/\n{2,}/) : text.split(/\n/);
  return blocks
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('\n');
}

// planFields is the matching "Lumora｜SEO 規劃" record's fields (by 網址路徑), or {} if none.
export function toArticleDetail(record, planFields = {}) {
  const f = record?.fields || {};
  const wordCount = f[ARTICLE_FIELD.wordCount] ?? 0;
  return {
    id: record?.id,
    slug: deriveSlug(f),
    path: f[ARTICLE_FIELD.path] || '',
    title: f[ARTICLE_FIELD.title] || planFields[PLAN_FIELD.suggestedTitle] || '',
    category: f[ARTICLE_FIELD.category] || planFields[PLAN_FIELD.category] || '',
    topicCluster: planFields[PLAN_FIELD.topicCluster] || '',
    keyword: planFields[PLAN_FIELD.keyword] || '',
    searchIntent: planFields[PLAN_FIELD.searchIntent] || '',
    body: f[ARTICLE_FIELD.body] || '',
    wordCount,
    readMinutes: estimateReadMinutes(wordCount),
    publishedAt: record?.createdTime || null,
  };
}

// planByPath maps a SEO-plan record's 網址路徑 -> its fields.
export function toArticleSummary(record, planByPath = {}) {
  const path = record?.fields?.[ARTICLE_FIELD.path] || '';
  const { body, ...detail } = toArticleDetail(record, planByPath[path] || {});
  return { ...detail, excerpt: buildExcerpt(body) };
}

// Guards against two articles deriving the same slug (e.g. shared last path segment).
export function dedupeSlugs(items) {
  const seen = new Map();
  return items.map(item => {
    const count = seen.get(item.slug) || 0;
    seen.set(item.slug, count + 1);
    return count === 0 ? item : { ...item, slug: `${item.slug}-${count + 1}` };
  });
}

export function sortByPublishedDesc(items) {
  return [...items].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}
