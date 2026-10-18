import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const cleanName = value => String(value ?? '').replace(/[^\w .-]/g, '').trim().slice(0, 16);

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const id = String(input?.id ?? '').slice(0, 128);
  const name = cleanName(input?.name);
  if (!/^[\w.-]{8,128}$/.test(id) || !name) return json({ error: 'A valid player ID and racer name are required.' }, 400);

  const rawCars = Array.isArray(input.cars) ? input.cars.slice(0, 33) : [];
  const cars = rawCars.map(car => ({
    i: Number(car?.i),
    l: Math.max(0, Math.min(1000, Number(car?.l) || 0)),
    w: Math.max(0, Math.min(100000, Number(car?.w) || 0)),
    col: /^#[0-9a-f]{6}$/i.test(String(car?.col ?? '')) ? String(car.col) : ''
  })).filter(car => Number.isInteger(car.i) && car.i >= 0 && car.i < 33);
  const seen = [...new Set((Array.isArray(input.seen) ? input.seen : [])
    .map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < 33))];
  const flags = input.f && typeof input.f === 'object' && !Array.isArray(input.f) ? input.f : {};
  const completedFlags = Object.values(flags).filter(Boolean).length;
  const score = cars.reduce((sum, car) => sum + car.l * 10 + car.w * 25 + 50, 0) + seen.length * 100 + completedFlags * 300;
  const key = 'players/' + createHash('sha256').update(id).digest('hex');
  const record = {
    h: createHash('sha256').update(id).digest('hex').slice(0, 12),
    name,
    score,
    dex: seen.length,
    cars,
    updatedAt: new Date().toISOString()
  };

  try {
    const store = getStore({ name: 'road-tamers-leaderboard', consistency: 'strong' });
    await store.setJSON(key, record);
    return json({ ok: true, score });
  } catch (error) {
    console.error('Road Tamers score write failed', error);
    return json({ error: 'Could not save score. Check Netlify Blobs is enabled for this site.' }, 503);
  }
}
