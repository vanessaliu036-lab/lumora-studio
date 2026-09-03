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

export function buildExcerpt(text, len = 200) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= len) return clean;
  const cut = clean.slice(0, len).replace(/\s+\S*$/, '');
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

const FAQ_HEADING = /frequently asked questions|faq/i;

function classifyLine(line) {
  const h2 = /^##\s+(.*)$/.exec(line);
  if (h2) return { type: 'h2', text: h2[1].trim() };
  const h3 = /^###\s+(.*)$/.exec(line);
  if (h3) return { type: 'h3', text: h3[1].trim() };
  const ol = /^\d+\.\s+(.*)$/.exec(line);
  if (ol) return { type: 'oli', text: ol[1].trim() };
  const ul = /^[-*]\s+(.*)$/.exec(line);
  if (ul) return { type: 'uli', text: ul[1].trim() };
  return null;
}

// Renders inline "**bold**" as <strong>, after escaping so any literal "<"/">" in the
// source text can't reopen a tag.
function renderInline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function stripInline(text) {
  return String(text || '').replace(/\*\*(.+?)\*\*/g, '$1');
}

// Article bodies use a markdown-lite convention: "## " for H2, "### " for H3, "- " / "1. "
// for lists, "**bold**" for emphasis, blank lines separate paragraphs. A "## Frequently
// Asked Questions" section whose "### " lines are questions (each followed by its answer
// paragraph) doubles as source data for FAQPage JSON-LD.
export function parseArticleBody(rawBody) {
  const lines = String(rawBody || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraphLines = [];
  let list = null; // { type: 'ul'|'ol', items: [] }

  const flushParagraph = () => {
    const text = paragraphLines.join(' ').trim();
    if (text) blocks.push({ type: 'p', text });
    paragraphLines = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push(list);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const c = classifyLine(line);
    if (c && (c.type === 'h2' || c.type === 'h3')) {
      flushParagraph();
      flushList();
      blocks.push(c);
    } else if (c && (c.type === 'uli' || c.type === 'oli')) {
      flushParagraph();
      const listType = c.type === 'uli' ? 'ul' : 'ol';
      if (!list || list.type !== listType) { flushList(); list = { type: listType, items: [] }; }
      list.items.push(c.text);
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushList();

  const faqs = [];
  let inFaqSection = false;
  blocks.forEach((block, i) => {
    if (block.type === 'h2') inFaqSection = FAQ_HEADING.test(block.text);
    if (inFaqSection && block.type === 'h3') {
      const question = stripInline(block.text.replace(/^Q[:.]\s+/i, ''));
      const answer = [];
      for (let j = i + 1; j < blocks.length && blocks[j].type === 'p'; j++) {
        answer.push(stripInline(blocks[j].text.replace(/^A[:.]\s+/i, '')));
      }
      if (answer.length) faqs.push({ question, answer: answer.join(' ') });
    }
  });

  const html = blocks.map(b => {
    if (b.type === 'h2' || b.type === 'h3') return `<${b.type}>${escapeHtml(b.text)}</${b.type}>`;
    if (b.type === 'ul' || b.type === 'ol') {
      return `<${b.type}>${b.items.map(item => `<li>${renderInline(item)}</li>`).join('')}</${b.type}>`;
    }
    return `<p>${renderInline(b.text)}</p>`;
  }).join('\n');

  const plainText = blocks
    .filter(b => b.type === 'p' || b.type === 'ul' || b.type === 'ol')
    .map(b => (b.type === 'p' ? stripInline(b.text) : b.items.map(stripInline).join(' ')))
    .join(' ');

  return { html, faqs, plainText };
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
  return { ...detail, excerpt: buildExcerpt(parseArticleBody(body).plainText) };
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
