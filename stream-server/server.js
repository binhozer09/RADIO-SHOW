"use strict";

const http = require("node:http");

const PORT = Number(process.env.PORT || 8000);

// Lista fixa fornecida pelo responsável. O servidor não consulta nem baixa mídia do YouTube.
const VIDEO_IDS = [
  "bWO1FNUTIao",
  "rBhKH-pTYGQ",
  "WffuNC-EjzY",
  "0YF7iz9Z-4k",
  "zyvCntqPnjE"
];

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
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
      service: "RADIO SHOW",
      online: true,
      playbackMode: "youtube-iframe-on-listener-device",
      playlistSize: VIDEO_IDS.length,
      downloadsEnabled: false
    });
  }

  if (req.method === "GET" && url.pathname === "/api/playlist") {
    return send(res, 200, {
      stationName: "RADIO SHOW",
      playlist: VIDEO_IDS.map((videoId, index) => ({ videoId, order: index + 1 })),
      repeat: true,
      playback: "official-youtube-iframe"
    });
  }

  // Compatibilidade com clientes antigos: entrega o primeiro item sem exigir metadados.
  if (req.method === "GET" && url.pathname === "/api/now-playing") {
    return send(res, 200, {
      videoId: VIDEO_IDS[0],
      queueIndex: 0,
      queueCount: VIDEO_IDS.length,
      playlist: VIDEO_IDS,
      repeat: true,
      playback: "official-youtube-iframe"
    });
  }

  return send(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("RADIO SHOW online na porta " + PORT + "; " + VIDEO_IDS.length + " vídeos cadastrados.");
});
