#!/usr/bin/env node
// tlsc-snapshot.js — bake the TL SC widget's live data into ONE self-contained
// HTML snapshot, reusable for a public static host (GitHub Pages).
// Reuses the tlnet-widget fetcher modules directly (they are plain Node modules).
'use strict';
const fs = require('fs');
const path = require('path');

const WIDGET = 'C:/Users/wretr/AppData/Local/hermes/tlnet-widget';
function req(m) { return require(path.join(WIDGET, 'src', m)); }

const OUT_DIR = process.env.TLSC_OUT || path.join(__dirname, 'site');
const OUT_HTML = path.join(OUT_DIR, 'index.html');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function iso(ts) { return new Date(ts).toISOString(); }

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const errors = [];
  const state = { bakedAt: Date.now(), scopes: {} };

  // News (TL.net RSS + Liquipedia recent changes merged)
  try {
    const news = req('news');
    const raw = await news.fetchNewsAggregate();
    state.scopes.news = { items: Array.isArray(raw) ? raw.slice(0, 25) : (raw && Array.isArray(raw.items) ? raw.items : []).slice(0, 25) };
  } catch (e) { errors.push('news: ' + e.message); }

  // Matches (Liquipedia Main_Page, live + upcoming + recent)
  try {
    const matches = req('matches');
    const raw = matches.fetchAll ? await matches.fetchAll() : await matches.fetchMatches();
    state.scopes.matches = (raw && Array.isArray(raw.matches) ? raw.matches : (Array.isArray(raw) ? raw : []));
    if (state.scopes.matches.length) state.scopes.matches = state.scopes.matches.slice(0, 40);
  } catch (e) { errors.push('matches: ' + e.message); }

  // SOOP female SC (femsc roster)
  try {
    const femsc = req('femsc');
    const raw = await femsc.fetchStreams();
    state.scopes.femsc = { streams: Array.isArray(raw) ? raw : (raw && Array.isArray(raw.streams) ? raw.streams : []) };
  } catch (e) { errors.push('femsc: ' + e.message); }

  // Twitch streams (may lack creds — record readiness)
  try {
    const tw = req('twitch');
    const have = tw.haveCreds ? await tw.haveCreds() : false;
    state.scopes.twitch = { haveCreds: have };
    if (have) {
      const raw = await tw.fetchStreams();
      state.scopes.twitch.streams = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.streams) ? raw.streams : []);
    }
  } catch (e) { errors.push('twitch: ' + e.message); }

  const lq = [];
  // Changes (Liquipedia recent-changes pulse)
  try {
    const changes = req('changes');
    const raw = await changes.fetchChanges();
    state.scopes.changes = Array.isArray(raw) ? raw.slice(0, 20) : [];
  } catch (e) { errors.push('changes: ' + e.message); }

  const newsRows = (state.scopes.news.items || []).map((it, i) =>
    `<div class="row news"><span class="src">${esc(it.source || 'TL.net')}</span>` +
    `<a href="${esc(it.link || it.url || '#')}" target="_blank">${esc(it.title || '')}</a>` +
    `<span class="t">${esc(rel(it.pubDate || it.ts))}</span></div>`).join('');

  const matchRows = (state.scopes.matches || []).map((m, i) => {
    const live = m.live === true || String(m.status || '').toLowerCase() === 'live';
    const team1 = m.p1 || m.team1 || '?';
    const team2 = m.p2 || m.team2 || '?';
    const remain = (typeof m.timeLeft === 'number') ? Math.max(0, Math.floor(m.timeLeft / 1000)) : (m.timeleft || '');
    const remStr = typeof remain === 'number' && remain > 0 ? `<span class="t">⏱ ${Math.floor(remain/60)}:${String(remain%60).padStart(2,'0')}</span>` : '';
    return `<div class="row match"><span class="status ${live?'live':'upcoming'}">${live?'LIVE':'upcoming'}</span><span class="teams">${esc(team1)} vs ${esc(team2)}</span>${remStr}</div>`;
  }).join('');

  const femscRows = ((state.scopes.femsc && state.scopes.femsc.streams) || []).map((s, i) =>
    `<div class="row stream"><span class="live">LIVE</span><span class="name">${esc(s.name || s.user || '')}</span>` +
    `<span class="game">${esc(s.game || s.category || '')}</span>` +
    `<span class="vw">${esc(s.viewers != null ? s.viewers : (s.acctNo || ''))}</span></div>`).join('');

  const twitchReady = state.scopes.twitch && state.scopes.twitch.haveCreds;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>TL SC Snapshot</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0f1115;color:#e6e8ec;margin:0;padding:0}
  header{padding:16px 20px;background:#171a21;border-bottom:1px solid #262b36}
  header h1{margin:0;font-size:18px}
  header .meta{color:#8b93a3;font-size:12px;margin-top:4px}
  main{max-width:860px;margin:0 auto;padding:20px}
  section{background:#171a21;border:1px solid #262b36;border-radius:10px;margin:14px 0;overflow:hidden}
  section h2{margin:0;padding:12px 16px;font-size:14px;background:#1c2029;border-bottom:1px solid #262b36}
  .row{display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid #1f242e;font-size:13px}
  .row:last-child{border-bottom:none}
  .row.news a{color:#8ab4ff;text-decoration:none}
  .src{font-size:10px;background:#2a2f3a;padding:2px 6px;border-radius:4px;color:#a8b0be;min-width:60px;text-align:center}
  .status{color:#ff6b6b;font-weight:600;font-size:11px}
  .status.upcoming{color:#ffd37a}
  .teams{color:#e6e8ec}
  .live{color:#ff5d5d;font-weight:700;font-size:11px}
  .game{color:#8b93a3;font-size:12px}
  .name{font-weight:500}
  .vw{color:#8b93a3;font-size:12px;margin-left:auto}
  .t{color:#8b93a3;font-size:12px;margin-left:auto;white-space:nowrap}
  .empty{color:#8b93a3;padding:16px;font-size:13px}
  .err{background:#2a1518;color:#ff9d9d;padding:10px 16px;font-size:12px;border-top:1px solid #3a1d22}
  footer{padding:14px 20px;color:#5c6472;font-size:11px;text-align:center}
</style></head>
<body>
<header>
  <h1>TL StarCraft — Live Snapshot</h1>
  <div class="meta">Baked ${iso(state.bakedAt)} · ${state.scopes.news.items ? state.scopes.news.items.length : 0} news · ${(state.scopes.matches||[]).length} matches · ${(state.scopes.femsc && state.scopes.femsc.streams||[]).length} SOOP live</div>
</header>
<main>
  <section><h2>News</h2>${newsRows ? newsRows : '<div class="empty">No news yet.</div>'}</section>
  <section><h2>Matches</h2>${matchRows ? matchRows : '<div class="empty">No matches yet.</div>'}</section>
  <section><h2>SOOP Female SC · Live</h2>${femscRows ? femscRows : '<div class="empty">None broadcasting now.</div>'}</section>
  <section><h2>Twitch Streams</h2>${twitchReady ? '<div class="empty">Creds present (rows baked separately).</div>' : '<div class="empty">No Twitch creds configured &mdash; TV dashboard offline in snapshot.</div>'}</section>
  ${errors.length ? `<section><h2>Errors</h2>${errors.map(e=>`<div class="err">${esc(e)}</div>`).join('')}</section>` : ''}
</main>
<footer>TL SC webapp snapshot &middot; generated by tlsc-snapshot.js &middot; open-source data from TL.net, Liquipedia, SOOP</footer>
</body></html>`;

  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log('WROTE', OUT_HTML, require('fs').statSync(OUT_HTML).size, 'bytes', 'errors=' + errors.length);
}

function rel(ts) {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return Math.round(s) + 's'; if (s < 3600) return Math.round(s / 60) + 'm';
  if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd';
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
