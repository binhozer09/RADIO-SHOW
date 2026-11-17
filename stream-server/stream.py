import os
import time
import subprocess
from pathlib import Path
from urllib.parse import quote

MUSIC_DIR = Path(os.getenv("MUSIC_DIR", "/music"))
PLAYLIST = Path("/tmp/radio-playlist.txt")
SOURCE_PASSWORD = quote(os.environ["ICECAST_SOURCE_PASSWORD"], safe="")
BITRATE = os.getenv("AUDIO_BITRATE", "128k")
PORT = os.getenv("PORT", "8000")
TARGET = f"icecast://source:{SOURCE_PASSWORD}@127.0.0.1:{PORT}/radio.mp3"
EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}

def make_playlist():
    candidates = sorted(
        p for p in MUSIC_DIR.rglob("*")
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )
    tracks = []
    for candidate in candidates:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(candidate)],
            capture_output=True, text=True, check=False
        )
        try:
            duration = float(probe.stdout.strip())
        except (TypeError, ValueError):
            continue
        if 0 < duration <= 300:
            tracks.append(candidate)

    if not tracks:
        return 0
    with PLAYLIST.open("w", encoding="utf-8") as f:
        for track in tracks:
            # FFmpeg concat demuxer escaping for paths containing quotes.
            escaped = str(track).replace("\\", "\\\\").replace("'", "\\'")
            f.write(f"file '{escaped}'\\n")
    return len(tracks)

while True:
    count = make_playlist()
    if not count:
        print(f"No audio files found in {MUSIC_DIR}; checking again in 60 seconds.", flush=True)
        time.sleep(60)
        continue

    print(f"Starting RADIO SHOW stream with {count} audio files.", flush=True)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning",
        "-re", "-stream_loop", "-1", "-f", "concat", "-safe", "0",
        "-i", str(PLAYLIST), "-vn", "-c:a", "libmp3lame",
        "-b:a", BITRATE, "-content_type", "audio/mpeg",
        "-f", "mp3", TARGET
    ]
    try:
        result = subprocess.run(command, check=False)
        print(f"Encoder stopped with code {result.returncode}; restarting in 5 seconds.", flush=True)
    except Exception as exc:
        print(f"Encoder error: {exc}; restarting in 5 seconds.", flush=True)
    time.sleep(5)
