// Shared HTML shell for the server-rendered /blog pages, styled to match the rest of
// the Lumora site (see images.html) so blog pages are crawlable without a build step.
import { escapeHtml } from './blog-content.mjs';

export const SITE_ORIGIN = 'https://lumora-studiokh.vercel.app';

const STYLES = `
:root{
  --ink:#f6f7fb;--muted:rgba(245,241,255,.68);--line:rgba(255,255,255,.14);
  --pink:#ffb0cc;--violet:#9a79ff;--peach:#ffd0bd;--mint:#8bf4dc;
  --night:#080817;--serif:"Italiana", Georgia, serif;--sans:"DM Sans", Arial, sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--night);color:var(--ink);font-family:var(--sans)}
body{
  background:
    radial-gradient(circle at 10% 8%, rgba(126,88,255,.24), transparent 30%),
    radial-gradient(circle at 90% 18%, rgba(255,153,197,.18), transparent 27%),
    radial-gradient(circle at 50% 92%, rgba(65,217,198,.12), transparent 28%),
    var(--night);
  min-height:100vh;
}
a{color:inherit;text-decoration:none}
.top-nav{
  position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:50;
  width:min(1320px,calc(100% - 28px));display:flex;align-items:center;justify-content:space-between;
  padding:12px 14px 12px 20px;background:rgba(11,9,28,.5);border:1px solid var(--line);
  border-radius:999px;backdrop-filter:blur(22px);box-shadow:0 16px 60px rgba(0,0,0,.28);
}
.top-nav .logo-image{display:block;width:118px;height:42px;object-fit:contain}
.top-nav .nav-links{display:flex;gap:22px;color:var(--muted);font-size:12px;white-space:nowrap}
.top-nav .nav-links a:hover{color:#fff}
.top-nav .cta{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 22px;
  border-radius:999px;background:linear-gradient(110deg,var(--peach),var(--pink),var(--violet));
  color:#fff;font-weight:500;font-size:13px;letter-spacing:.04em;box-shadow:0 12px 34px rgba(170,105,255,.35);
}
.wrap{width:min(1080px,calc(100% - 32px));margin:auto;padding:120px 0 100px}
.back-link{display:inline-flex;align-items:center;gap:8px;margin-bottom:40px;color:var(--muted);font-size:13px}
.back-link:hover{color:#fff}
.kicker{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#d9c9ff;margin-bottom:18px}
.head{text-align:center;margin-bottom:64px;max-width:760px;margin-left:auto;margin-right:auto}
.head h1{font-family:var(--serif);font-size:clamp(40px,6vw,80px);line-height:.98;font-weight:400;letter-spacing:-.05em;margin:0 0 20px}
.head h1 span{background:linear-gradient(90deg,#fff 10%,#ffd4e8 48%,#bda6ff 90%);-webkit-background-clip:text;background-clip:text;color:transparent}
.head p{font-size:17px;line-height:1.6;color:var(--muted);margin:0 auto;max-width:620px}
.article-meta{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;color:rgba(255,255,255,.5);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-top:18px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.card{
  display:flex;flex-direction:column;gap:10px;padding:28px;border-radius:22px;
  border:1px solid var(--line);background:rgba(19,17,40,.6);
  transition:transform .5s ease,border-color .5s ease,box-shadow .5s ease;
}
.card:hover{transform:translateY(-4px);border-color:rgba(255,207,235,.4);box-shadow:0 30px 80px rgba(146,101,255,.25)}
.card .chip{
  align-self:flex-start;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);
  background:rgba(12,9,32,.5);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint);
}
.card h2{font-family:var(--serif);font-size:24px;font-weight:400;letter-spacing:-.02em;margin:4px 0 0}
.card p{font-size:14px;line-height:1.6;color:var(--muted);margin:0}
.card .meta{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-top:auto}
.empty{grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted);border:1px dashed var(--line);border-radius:22px;font-size:15px}
.prose{max-width:720px;margin:0 auto;font-size:17px;line-height:1.85;color:rgba(245,241,255,.88)}
.prose p{margin:0 0 22px}
.prose h2{font-family:var(--serif);font-size:clamp(24px,3vw,32px);font-weight:400;letter-spacing:-.015em;color:#fff;margin:48px 0 18px}
.prose h3{font-size:19px;font-weight:600;color:#fff;margin:30px 0 10px}
.prose h2:first-child,.prose h3:first-child{margin-top:0}
.prose strong{color:#fff;font-weight:600}
.prose ul,.prose ol{margin:0 0 22px;padding-left:22px}
.prose li{margin:0 0 10px}
@media (max-width:760px){
  .grid{grid-template-columns:1fr}
  .top-nav .nav-links{display:none}
  .wrap{padding:100px 0 70px}
}
`;

// data: a plain object, or an array of them for multiple schema blocks (e.g. Article + FAQPage).
function jsonLdScript(data) {
  // Escape "<" so a literal "</script>" inside string content can't close the tag early.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

export function renderShell({ title, description, canonical, jsonLd, bodyHtml }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const jsonLdHtml = (Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [])
    .filter(Boolean)
    .map(jsonLdScript)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<meta name="description" content="${safeDesc}">
<link rel="canonical" href="${safeCanonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDesc}">
<meta property="og:url" content="${safeCanonical}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Italiana&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<nav class="top-nav">
  <a href="/index.html#top" class="logo" aria-label="Lumora home"><img class="logo-image" src="/lumora-logo.png" alt="Lumora"></a>
  <div class="nav-links">
    <a href="/index.html#why">Why Lumora</a>
    <a href="/blog">Journal</a>
    <a href="/index.html#pricing">Pricing</a>
    <a href="/index.html#contact">Contact</a>
  </div>
  <a href="/index.html#contact" class="cta">Start Your Portrait ↗</a>
</nav>
<div class="wrap">
${bodyHtml}
</div>
${jsonLdHtml}
</body>
</html>`;
}
