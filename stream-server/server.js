"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8000);
const MAX_DURATION_SECONDS = Math.min(300, Math.max(1, Number(process.env.MAX_DURATION_SECONDS || 300)));
const STATE_FILE = process.env.STATE_FILE || "/music/schedule.json";
const REFRESH_MS = 6 * 60 * 60 * 1000;

// Lista fixa enviada pelo responsável pela rádio. Nenhuma YouTube Data API é usada.
const VIDEO_IDS = [
  "bWO1FNUTIao",
  "rBhKH-pTYGQ",
  "WffuNC-EjzY",
  "0YF7iz9Z-4k",
  "zyvCntqPnjE"
];

let schedule = null;
let lastRefresh = 0;
let refreshPromise = null;
let lastError = null;

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

async function fetchVideoMetadata(videoId) {
  let lastFailure = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch("https://www.youtube.com/watch?v=" + encodeURIComponent(videoId) + "&hl=pt-BR", {
        headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36", "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" },
        signal: AbortSignal.timeout(20000)
      });
      if (response.status === 429 || response.status === 503) {
        lastFailure = new Error("YouTube retornou HTTP " + response.status + " para " + videoId);
        await new Promise(resolve => setTimeout(resolve, 2500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error("YouTube retornou HTTP " + response.status + " para " + videoId);
      const html = await response.text();
      const durationMatch = html.match(/"lengthSeconds"\s*:\s*"?(\\d+)"?/);
      if (!durationMatch) throw new Error("Não foi possível ler a duração do vídeo " + videoId + " na página do YouTube.");
      const durationSeconds = Number(durationMatch[1]);
      if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > MAX_DURATION_SECONDS) {
        throw new Error("O vídeo " + videoId + " não atende ao limite de " + MAX_DURATION_SECONDS + " segundos.");
      }
      const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') : "Robinho Show";
      return { videoId, title, durationSeconds };
    } catch (error) {
      lastFailure = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastFailure || new Error("Não foi possível consultar " + videoId);
}

async function fetchFixedPlaylist() {
  // Consulta sequencial e com tentativas para evitar bloqueio por muitas requisições; não baixa mídia.
  const videos = [];
  for (const videoId of VIDEO_IDS) {
    videos.push(await fetchVideoMetadata(videoId));
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  return videos;
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(schedule), "utf8");
  } catch (error) {
    console.error("Não foi possível persistir a programação:", error.message);
  }
}

function loadState() {
  try {
    const value = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (Array.isArray(value.videos) && value.videos.length === VIDEO_IDS.length && Number.isFinite(value.startAt)) schedule = value;
  } catch (_) {}
}

async function refreshSchedule(force = false) {
  if (refreshPromise) return refreshPromise;
  if (!force && schedule && Date.now() - lastRefresh < REFRESH_MS) return schedule;
  refreshPromise = (async () => {
    const videos = await fetchFixedPlaylist();
    const fingerprint = videos.map(v => v.videoId + ":" + v.durationSeconds).join("|");
    if (!schedule || schedule.fingerprint !== fingerprint) {
      schedule = { videos, fingerprint, startAt: Date.now(), updatedAt: new Date().toISOString() };
      saveState();
      console.log("Programação fixa sincronizada: " + videos.length + " vídeos; início " + schedule.updatedAt);
    } else {
      schedule.videos = videos;
      schedule.updatedAt = new Date().toISOString();
      saveState();
      console.log("Metadados das cinco músicas atualizados; relógio global preservado.");
    }
    lastRefresh = Date.now();
    lastError = null;
    return schedule;
  })().catch(error => {
    lastError = error.message;
    console.error("Falha ao atualizar programação:", error.message);
    if (schedule) {
      lastRefresh = Date.now();
      console.warn("Mantendo a última programação persistida.");
      return schedule;
    }
    throw error;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function nowPlaying() {
  if (!schedule?.videos?.length) return null;
  const total = schedule.videos.reduce((sum, video) => sum + video.durationSeconds, 0);
  const elapsed = Math.max(0, (Date.now() - schedule.startAt) / 1000);
  const cycle = Math.floor(elapsed / total);
  let position = elapsed % total;
  let index = 0;
  while (index < schedule.videos.length - 1 && position >= schedule.videos[index].durationSeconds) {
    position -= schedule.videos[index].durationSeconds;
    index++;
  }
  const current = schedule.videos[index];
  return {
    videoId: current.videoId,
    title: current.title,
    durationSeconds: current.durationSeconds,
    positionSeconds: Math.floor(position),
    queueIndex: index,
    queueCount: schedule.videos.length,
    cycle,
    serverTime: Date.now(),
    scheduleStartedAt: schedule.startAt,
    updatedAt: schedule.updatedAt,
    maxDurationSeconds: MAX_DURATION_SECONDS
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    return res.end();
  }
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      service: "RADIO SHOW YouTube Sync",
      scheduleLoaded: Boolean(schedule),
      playlistSize: VIDEO_IDS.length,
      metadataError: lastError
    });
  }
  if (req.method === "GET" && url.pathname === "/api/now-playing") {
    try {
      await refreshSchedule();
      return send(res, 200, nowPlaying());
    } catch (error) {
      return send(res, 503, {
        error: "A programação ainda não pode ser sincronizada.",
        detail: error.message,
        cachedScheduleAvailable: Boolean(schedule)
      });
    }
  }
  return send(res, 404, { error: "Not found" });
});

loadState();
server.listen(PORT, "0.0.0.0", () => {
  console.log("RADIO SHOW YouTube Sync ativo na porta " + PORT);
  refreshSchedule(true).catch(() => {});
});
setInterval(() => refreshSchedule(true).catch(() => {}), REFRESH_MS).unref();
