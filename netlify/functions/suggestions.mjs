import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const categories = new Set(['car', 'storyline', 'character', 'feedback']);
const store = () => getStore({ name: 'road-tamers-suggestions', consistency: 'strong' });

export default async function handler(request) {
  if (request.method === 'GET') {
    const expected = process.env.RT_SUGGESTION_ADMIN_KEY || '';
    const authorization = request.headers.get('authorization') || '';
    const supplied = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    if (!expected) return json({ error: 'The private inbox is not configured yet.' }, 503);
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      return json({ error: 'Owner access key is incorrect.' }, 401);
    }
    try {
      const db = store();
      const { blobs = [] } = await db.list({ prefix: 'ideas/' });
      const ideas = [];
      for (const entry of blobs) {
        const idea = await db.get(entry.key, { type: 'json', consistency: 'strong' });
        if (idea && categories.has(idea.category) && typeof idea.message === 'string') {
          ideas.push({ category: idea.category, message: idea.message, createdAt: idea.createdAt });
        }
      }
      ideas.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return json({ items: ideas.slice(0, 100) });
    } catch (error) {
      console.error('Road Tamers private suggestions read failed', error);
      return json({ error: 'Private ideas are not available right now.' }, 503);
    }
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid suggestion.' }, 400); }

  if (String(input?.website ?? '').trim()) return json({ error: 'Invalid suggestion.' }, 400);
  const category = String(input?.category ?? '');
  const message = String(input?.message ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 400);
  if (!categories.has(category) || message.length < 8) {
    return json({ error: 'Choose a topic and write at least 8 characters.' }, 400);
  }

  try {
    const db = store();
    const ip = request.headers.get('x-nf-client-connection-ip') || '';
    if (ip) {
      const rateKey = 'ratelimits/' + createHash('sha256').update(ip).digest('hex');
      const previous = await db.get(rateKey, { type: 'json', consistency: 'strong' });
      const now = Date.now();
      if (previous?.at && now - previous.at < 45000) {
        return json({ error: 'Please wait a little before sending another idea.' }, 429);
      }
      await db.setJSON(rateKey, { at: now });
    }

    const idea = { category, message, createdAt: new Date().toISOString() };
    await db.setJSON('ideas/' + randomUUID(), idea);
    return json({ ok: true }, 201);
  } catch (error) {
    console.error('Road Tamers suggestion write failed', error);
    return json({ error: 'Could not save your idea right now. Please try again later.' }, 503);
  }
}
