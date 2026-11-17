"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const PORT = Number(process.env.PORT || 8000);
const VIDEO_IDS = ["bWO1FNUTIao","rBhKH-pTYGQ","WffuNC-EjzY","0YF7iz9Z-4k","zyvCntqPnjE"];
const STATE_FILE = process.env.STATE_FILE || "/music/radio-playback-state.json";
let state = { index: 0, currentTime: 0, durations: VIDEO_IDS.map(() => 240), updatedAt: Date.now() };
try {
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  if (Array.isArray(saved.durations) && saved.durations.length === VIDEO_IDS.length) state = saved;
} catch {}
function saveState() {
  try { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state)); }
  catch (error) { console.error("Não foi possível salvar o estado da programação:", error.message); }
}
function currentSchedule() {
  const durations = VIDEO_IDS.map((_, i) => Math.max(1, Number(state.durations?.[i]) || 240));
  let index = Math.max(0, Math.min(VIDEO_IDS.length - 1, Number(state.index) || 0));
  let position = Math.max(0, Number(state.currentTime) || 0) + Math.max(0, Date.now() - Number(state.updatedAt || Date.now())) / 1000;
  let guard = 0;
  while (position >= durations[index] && guard++ < 1000) { position -= durations[index]; index = (index + 1) % VIDEO_IDS.length; }
  return { videoId: VIDEO_IDS[index], index, currentTime: Math.floor(position), durations, updatedAt: state.updatedAt, playlist: VIDEO_IDS, repeat: true };
}
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "RADIO SHOW", online: true, playback: "official-youtube-player", playlistSize: VIDEO_IDS.length, repeat: true });
  if (req.method === "GET" && url.pathname === "/api/playlist") return send(res, 200, { stationName: "RADIO SHOW", playlist: VIDEO_IDS.map((videoId, index) => ({ videoId, order: index + 1 })), repeat: true, playback: "official-youtube-iframe" });
  if (req.method === "GET" && (url.pathname === "/api/sync" || url.pathname === "/api/now-playing")) return send(res, 200, currentSchedule());
  if (req.method === "POST" && url.pathname === "/api/sync") {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 16384) req.destroy(); });
    req.on("end", () => {
      try {
        const body = JSON.parse(raw || "{}");
        const index = Math.max(0, Math.min(VIDEO_IDS.length - 1, Number(body.index) || 0));
        const durations = Array.isArray(body.durations) && body.durations.length === VIDEO_IDS.length ? body.durations.map(x => Math.max(1, Math.min(3600, Number(x) || 240))) : state.durations;
        state = { index, currentTime: Math.max(0, Math.min(3600, Number(body.currentTime) || 0)), durations, updatedAt: Date.now() };
        saveState();
        return send(res, 200, { ok: true, ...currentSchedule() });
      } catch { return send(res, 400, { error: "Estado de reprodução inválido." }); }
    });
    return;
  }
  return send(res, 404, { error: "Not found" });
});
server.listen(PORT, "0.0.0.0", () => console.log("RADIO SHOW online; programação YouTube sincronizada no Railway."));
