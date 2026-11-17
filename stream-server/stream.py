import os
import time
import subprocess
from pathlib import Path
from urllib.parse import quote

MUSIC_DIR = Path(os.getenv("MUSIC_DIR", "/music"))
PLAYLIST = Path("/tmp/radio-playlist.txt")
SOURCE_PASSWORD = quote(os.environ["ICECAST_SOURCE_PASSWORD"], safe="")
BITRATE = os.getenv("AUDIO_BITRATE", "128k")
TARGET = f"icecast://source:{SOURCE_PASSWORD}@127.0.0.1:8000/radio.mp3"
EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}

def make_playlist():
    tracks = sorted(
        p for p in MUSIC_DIR.rglob("*")
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )
    if not tracks:
        return 0
    with PLAYLIST.open("w", encoding="utf-8") as f:
        for track in tracks:
            # FFmpeg concat demuxer escaping for paths containing quotes.
            path = str(track).replace("\\", "\\\\").replace("'", "\\'")
            f.write(f"file '{path}'\n")
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
