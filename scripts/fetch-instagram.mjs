#!/usr/bin/env node
// Fetches recent Instagram posts via the Instagram Graph API and writes posts.json.
// Token comes from IG_TOKEN secret (EAA long-lived token).

import { writeFileSync } from 'node:fs';

const TOKEN = process.env.IG_TOKEN;
if (!TOKEN) { console.error('Missing IG_TOKEN'); process.exit(1); }

const FIELDS = 'id,caption,media_url,thumbnail_url,permalink,media_type,timestamp';
const LIMIT = 50;
const URL = `https://graph.instagram.com/me/media?fields=${FIELDS}&limit=${LIMIT}&access_token=${encodeURIComponent(TOKEN)}`;

const res = await fetch(URL);
if (!res.ok) {
  const body = await res.text();
  console.error(`IG API ${res.status}: ${body}`);
  process.exit(1);
}

const json = await res.json();
if (json.error) { console.error('IG error:', json.error); process.exit(1); }

const posts = (json.data || [])
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
