#!/usr/bin/env node
// Refreshes the Instagram long-lived token (~60 day lifetime).
// Calls IG refresh endpoint, then updates the IG_TOKEN repo secret via GH API.
// Requires: IG_TOKEN (current), GH_PAT (PAT with repo scope), GITHUB_REPOSITORY.

import sodium from 'tweetsodium';

const { IG_TOKEN, GH_PAT, GITHUB_REPOSITORY } = process.env;
if (!IG_TOKEN || !GH_PAT || !GITHUB_REPOSITORY) {
  console.error('Missing IG_TOKEN, GH_PAT, or GITHUB_REPOSITORY');
  process.exit(1);
}

// 1. Refresh the IG token
const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(IG_TOKEN)}`;
const res = await fetch(refreshUrl);
if (!res.ok) {
  console.error(`Refresh failed ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { access_token, expires_in } = await res.json();
if (!access_token) { console.error('No token in refresh response'); process.exit(1); }
console.log(`New token valid for ${expires_in}s (~${Math.round(expires_in / 86400)} days)`);

// 2. Get repo public key for secret encryption
const keyRes = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/secrets/public-key`, {
  headers: { Authorization: `Bearer ${GH_PAT}`, Accept: 'application/vnd.github+json' }
});
if (!keyRes.ok) { console.error('Failed to get public key:', await keyRes.text()); process.exit(1); }
const { key, key_id } = await keyRes.json();

// 3. Encrypt new token
const messageBytes = Buffer.from(access_token);
const keyBytes = Buffer.from(key, 'base64');
const encryptedBytes = sodium.seal(messageBytes, keyBytes);
const encrypted_value = Buffer.from(encryptedBytes).toString('base64');

// 4. PUT updated secret
const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/secrets/IG_TOKEN`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${GH_PAT}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ encrypted_value, key_id })
});
if (!putRes.ok) { console.error('Failed to update secret:', await putRes.text()); process.exit(1); }
console.log('IG_TOKEN secret updated successfully');
