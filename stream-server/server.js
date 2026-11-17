"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8000);
const API_KEY = process.env.YOUTUBE_API_KEY || "";
const CHANNEL_HANDLE = (process.env.YOUTUBE_CHANNEL_HANDLE || "RobinhoShowOficial").replace(/^@/, "");
const MAX_DURATION_SECONDS = Math.min(300, Math.max(1, Number(process.env.MAX_DURATION_SECONDS || 300)));
const STATE_FILE = process.env.STATE_FILE || "/music/schedule.json";
const REFRESH_MS = 15 * 60 * 1000;

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

function durationSeconds(value) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value || "");
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

async function youtube(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) {
    const message = data.error?.message || ("YouTube API HTTP " + response.status);
    throw new Error(message);
  }
  return data;
}

async function fetchEligibleVideos() {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY não configurada no Railway.");
  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.search = new URLSearchParams({ part: "contentDetails", forHandle: CHANNEL_HANDLE, key: API_KEY });
  const channel = await youtube(channelUrl);
  const uploadsId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error("Não foi possível localizar a playlist de envios do canal @" + CHANNEL_HANDLE + ".");
  const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  playlistUrl.search = new URLSearchParams({
    part: "contentDetails,snippet",
    playlistId: uploadsId,
    maxResults: "50",
    key: API_KEY
  });
  const playlist = await youtube(playlistUrl);
  const ids = [...new Set((playlist.items || [])
    .map(item => item.contentDetails?.videoId)
    .filter(Boolean))];
  if (!ids.length) throw new Error("A playlist de envios do canal não retornou vídeos.");

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.search = new URLSearchParams({
    part: "contentDetails,status,snippet",
    id: ids.join(","),
    key: API_KEY
  });
  const details = await youtube(videosUrl);
  const byId = new Map((details.items || []).map(item => [item.id, item]));
  const eligible = ids.map(id => byId.get(id)).filter(video => {
    if (!video || video.status?.embeddable === false || video.status?.privacyStatus === "private") return false;
    const seconds = durationSeconds(video.contentDetails?.duration);
    return seconds > 0 && seconds <= MAX_DURATION_SECONDS;
  }).map(video => ({
    videoId: video.id,
    title: video.snippet?.title || "Robinho Show",
    durationSeconds: durationSeconds(video.contentDetails.duration)
  }));
  if (!eligible.length) throw new Error("Nenhum vídeo público incorporável de até " + MAX_DURATION_SECONDS + " segundos foi encontrado entre os 50 envios mais recentes.");
  return eligible;
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(schedule), "utf8");
  } catch (error) {
    console.error("Não foi possível persistir o relógio da programação:", error.message);
  }
}

function loadState() {
  try {
    const value = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (Array.isArray(value.videos) && value.videos.length && Number.isFinite(value.startAt)) schedule = value;
  } catch (_) {}
}

async function refreshSchedule(force = false) {
  if (refreshPromise) return refreshPromise;
  if (!force && schedule && Date.now() - lastRefresh < REFRESH_MS) return schedule;
  refreshPromise = (async () => {
    const videos = await fetchEligibleVideos();
    const fingerprint = videos.map(v => v.videoId + ":" + v.durationSeconds).join("|");
    if (!schedule || schedule.fingerprint !== fingerprint) {
      schedule = { videos, fingerprint, startAt: Date.now(), updatedAt: new Date().toISOString() };
      saveState();
      console.log("Programação sincronizada: " + videos.length + " vídeos elegíveis; início " + schedule.updatedAt);
    } else {
      schedule.videos = videos;
      schedule.updatedAt = new Date().toISOString();
      saveState();
      console.log("Catálogo atualizado: " + videos.length + " vídeos; relógio global preservado.");
    }
    lastRefresh = Date.now();
    lastError = null;
    return schedule;
  })().catch(error => {
    lastError = error.message;
    console.error("Falha ao atualizar catálogo do YouTube:", error.message);
    if (schedule) {
      lastRefresh = Date.now();
      console.warn("Usando o último catálogo persistido até a próxima tentativa.");
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
    return send(res, 200, { ok: true, service: "RADIO SHOW YouTube Sync", scheduleLoaded: Boolean(schedule), apiKeyConfigured: Boolean(API_KEY) });
  }
  if (req.method === "GET" && url.pathname === "/api/now-playing") {
    try {
      await refreshSchedule();
      return send(res, 200, nowPlaying());
    } catch (error) {
      return send(res, API_KEY ? 503 : 424, {
        error: "A programação ainda não pode ser sincronizada.",
        detail: error.message,
        setupRequired: !API_KEY,
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
