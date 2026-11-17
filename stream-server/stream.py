import os
import time
import subprocess
from pathlib import Path
from urllib.parse import quote

MUSIC_DIR = Path(os.getenv("MUSIC_DIR", "/music"))
PLAYLIST = Path("/tmp/radio-playlist.txt")
PASSWORD = quote(os.environ["ICECAST_SOURCE_PASSWORD"], safe="")
BITRATE = os.getenv("AUDIO_BITRATE", "128k")
TARGET = f"icecast://source:{PASSWORD}@127.0.0.1:8000/radio.mp3"
EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}

def duration_seconds(path):
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=20, check=True
        )
        return float(result.stdout.strip())
    except Exception as exc:
        print(f"Não foi possível ler duração de {path.name}: {exc}", flush=True)
        return None

while True:
    candidates = sorted(p for p in MUSIC_DIR.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSIONS)
    tracks = []
    for path in candidates:
        duration = duration_seconds(path)
        if duration is not None and 0 < duration <= 300:
            tracks.append(path)
        elif duration is not None:
            print(f"Ignorando {path.name}: duração acima de 5 minutos.", flush=True)

    if not tracks:
        print(f"Nenhuma faixa válida (até 5 minutos) em {MUSIC_DIR}; nova verificação em 60 segundos.", flush=True)
        time.sleep(60)
        continue

    with PLAYLIST.open("w", encoding="utf-8") as f:
        for track in tracks:
            escaped = str(track).replace("\\", "\\\\").replace("'", "\\'")
            f.write(f"file '{escaped}'\n")

    print(f"Transmitindo RADIO SHOW: {len(tracks)} faixas de até 5 minutos em repetição.", flush=True)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-re",
        "-stream_loop", "-1", "-f", "concat", "-safe", "0",
        "-i", str(PLAYLIST), "-vn", "-c:a", "libmp3lame",
        "-b:a", BITRATE, "-content_type", "audio/mpeg", "-f", "mp3", TARGET
    ]
    try:
        result = subprocess.run(command, check=False)
        print(f"Codificador encerrou ({result.returncode}); reiniciando em 5 segundos.", flush=True)
    except Exception as exc:
        print(f"Erro no codificador: {exc}; reiniciando em 5 segundos.", flush=True)
    time.sleep(5)
