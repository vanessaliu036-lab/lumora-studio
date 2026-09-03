import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  deriveSlug,
  buildExcerpt,
  estimateReadMinutes,
  isPublished,
  escapeHtml,
  bodyToHtmlParagraphs,
  toArticleSummary,
  toArticleDetail,
  dedupeSlugs,
  sortByPublishedDesc,
  PUBLISHED_STATUS,
} from '../lib/blog-content.mjs';

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('AI Advertising for Hotels in Cambodia!'), 'ai-advertising-for-hotels-in-cambodia');
  assert.equal(slugify('  --Leading/Trailing--  '), 'leading-trailing');
});

test('deriveSlug prefers the last segment of 網址路徑', () => {
  assert.equal(
    deriveSlug({ '網址路徑': '/industries/hotel-ai-advertising-cambodia', '頁面標題': 'Ignored' }),
    'hotel-ai-advertising-cambodia'
  );
});

test('deriveSlug falls back to the title when 網址路徑 is empty', () => {
  assert.equal(deriveSlug({ '頁面標題': 'Generative AI Advertising: A Guide' }), 'generative-ai-advertising-a-guide');
});

test('buildExcerpt collapses whitespace and truncates on a word boundary', () => {
  const body = 'Lumora builds AI-driven commercial campaigns for brands across Cambodia and the region.';
  assert.equal(buildExcerpt(body, 20), 'Lumora builds…');
  assert.equal(buildExcerpt('short text'), 'short text');
  assert.equal(buildExcerpt(''), '');
});

test('estimateReadMinutes assumes ~200 words per minute with a 1-minute floor', () => {
  assert.equal(estimateReadMinutes(0), 1);
  assert.equal(estimateReadMinutes(150), 1);
  assert.equal(estimateReadMinutes(1600), 8);
});

test('isPublished only accepts the 已完成 status', () => {
  assert.equal(isPublished({ '狀態': PUBLISHED_STATUS }), true);
  assert.equal(isPublished({ '狀態': '待審核' }), false);
  assert.equal(isPublished({}), false);
});

test('escapeHtml escapes the five reserved characters', () => {
  assert.equal(escapeHtml(`<script>alert('x')&"y"</script>`), '&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;y&quot;&lt;/script&gt;');
});

test('bodyToHtmlParagraphs splits on blank lines and escapes content', () => {
  const html = bodyToHtmlParagraphs('First <b>paragraph</b>.\n\nSecond paragraph.');
  assert.equal(html, '<p>First &lt;b&gt;paragraph&lt;/b&gt;.</p>\n<p>Second paragraph.</p>');
});

test('bodyToHtmlParagraphs falls back to single newlines when there are no blank lines', () => {
  const html = bodyToHtmlParagraphs('Line one.\nLine two.');
  assert.equal(html, '<p>Line one.</p>\n<p>Line two.</p>');
});

test('toArticleDetail merges article fields with SEO-plan fallbacks', () => {
  const record = {
    id: 'rec1',
    createdTime: '2026-09-01T00:00:00.000Z',
    fields: {
      '頁面標題': '',
      '網址路徑': '/ai-commercial-production-cambodia',
      '類別': 'Article',
      '正文': 'Body text with a few words here.',
      '字數': 400,
      '狀態': PUBLISHED_STATUS,
    },
  };
  const planFields = { '建議標題': 'AI Commercial Production Cambodia | Lumora Studio', '關鍵字': 'AI commercial production Cambodia' };
  const detail = toArticleDetail(record, planFields);
  assert.equal(detail.title, 'AI Commercial Production Cambodia | Lumora Studio');
  assert.equal(detail.slug, 'ai-commercial-production-cambodia');
  assert.equal(detail.keyword, 'AI commercial production Cambodia');
  assert.equal(detail.readMinutes, 2);
  assert.equal(detail.body, 'Body text with a few words here.');
});

test('toArticleSummary omits body but includes an excerpt', () => {
  const record = {
    id: 'rec2',
    createdTime: '2026-09-01T00:00:00.000Z',
    fields: { '頁面標題': 'Hello World', '網址路徑': '/hello-world', '正文': 'A short body.', '字數': 3, '狀態': PUBLISHED_STATUS },
  };
  const summary = toArticleSummary(record, {});
  assert.equal('body' in summary, false);
  assert.equal(summary.excerpt, 'A short body.');
});

test('dedupeSlugs appends a numeric suffix on collision', () => {
  const items = [{ slug: 'guide' }, { slug: 'guide' }, { slug: 'other' }];
  assert.deepEqual(dedupeSlugs(items).map(i => i.slug), ['guide', 'guide-2', 'other']);
});

test('sortByPublishedDesc orders newest first without mutating the input', () => {
  const items = [
    { slug: 'a', publishedAt: '2026-01-01T00:00:00.000Z' },
    { slug: 'b', publishedAt: '2026-06-01T00:00:00.000Z' },
  ];
  const sorted = sortByPublishedDesc(items);
  assert.deepEqual(sorted.map(i => i.slug), ['b', 'a']);
  assert.deepEqual(items.map(i => i.slug), ['a', 'b']);
});
