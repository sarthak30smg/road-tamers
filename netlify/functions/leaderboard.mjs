import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const store = getStore({ name: 'road-tamers-leaderboard', consistency: 'strong' });
    const { blobs = [] } = await store.list({ prefix: 'players/' });
    const items = [];
    for (const entry of blobs) {
      const player = await store.get(entry.key, { type: 'json', consistency: 'strong' });
      if (!player || typeof player.name !== 'string') continue;
      items.push(player);
    }
    items.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return json({ items: items.slice(0, 100) });
  } catch (error) {
    console.error('Road Tamers leaderboard read failed', error);
    return json({ error: 'Leaderboard storage is not available yet.' }, 503);
  }
}
