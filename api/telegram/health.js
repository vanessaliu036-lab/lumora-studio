export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) return res.status(502).json({ ok: false, error: payload?.description || 'Telegram bot authentication failed' });
    return res.status(200).json({ ok: true, bot: { id: payload.result.id, username: payload.result.username, name: payload.result.first_name } });
  } catch (error) {
    return res.status(502).json({ ok: false, error: String(error.message || error) });
  }
}
