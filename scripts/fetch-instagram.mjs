#!/usr/bin/env node
// Fetches recent Instagram posts via the Facebook Graph API (EAA tokens)
// and writes posts.json. Token comes from IG_TOKEN secret.

import { writeFileSync } from 'node:fs';

const TOKEN = process.env.IG_TOKEN;
if (!TOKEN) { console.error('Missing IG_TOKEN'); process.exit(1); }

// Debug: show token length and first/last chars to verify it's not corrupted
const trimmed = TOKEN.trim();
console.log(`Token length: ${TOKEN.length}, trimmed: ${trimmed.length}`);
console.log(`Starts with: ${trimmed.substring(0, 4)}... Ends with: ...${trimmed.substring(trimmed.length - 4)}`);
if (TOKEN !== trimmed) {
  console.warn('WARNING: Token had leading/trailing whitespace — using trimmed version');
}

const API = 'https://graph.facebook.com/v21.0';
const FIELDS = 'id,caption,media_url,thumbnail_url,permalink,media_type,timestamp';

async function gget(path, params = {}) {
  const qs = new URLSearchParams({ access_token: trimmed, ...params }).toString();
  const url = `${API}${path}?${qs}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    console.error(`GET ${path} failed:`, JSON.stringify(body));
    process.exit(1);
  }
  return body;
}

// 1. Find the Facebook Page(s) this token can see
const pages = await gget('/me/accounts', { fields: 'id,name,instagram_business_account' });
if (!pages.data || !pages.data.length) {
  console.error('No Facebook Pages accessible with this token.');
  process.exit(1);
}

// 2. Find the first Page with an Instagram Business Account linked
const withIg = pages.data.find(p => p.instagram_business_account && p.instagram_business_account.id);
if (!withIg) {
  console.error('No Instagram Business Account linked to any accessible Page.');
  console.error('Pages found:', pages.data.map(p => p.name).join(', '));
  process.exit(1);
}
const igUserId = withIg.instagram_business_account.id;
console.log(`Using Page "${withIg.name}" -> IG user ${igUserId}`);

// 3. Fetch media
const media = await gget(`/${igUserId}/media`, { fields: FIELDS, limit: '50' });

const posts = (media.data || [])
  .filter(p => ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].includes(p.media_type))
  .map(p => ({
    id: p.id,
    caption: p.caption || '',
    media_url: p.media_url,
    thumbnail_url: p.thumbnail_url || null,
    permalink: p.permalink,
    media_type: p.media_type,
    timestamp: p.timestamp
  }));

const out = { updated: new Date().toISOString(), count: posts.length, posts };
writeFileSync('posts.json', JSON.stringify(out, null, 2));
console.log(`Wrote ${posts.length} posts to posts.json`);
