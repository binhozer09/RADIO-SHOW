#!/bin/sh
set -eu

: "${ICECAST_SOURCE_PASSWORD:?Configure ICECAST_SOURCE_PASSWORD}"
: "${ICECAST_ADMIN_PASSWORD:?Configure ICECAST_ADMIN_PASSWORD}"
: "${ICECAST_RELAY_PASSWORD:=${ICECAST_SOURCE_PASSWORD}}"
: "${PUBLIC_HOSTNAME:=localhost}"
: "${PORT:=8000}"

export ICECAST_RELAY_PASSWORD PUBLIC_HOSTNAME PORT
envsubst '${ICECAST_SOURCE_PASSWORD} ${ICECAST_ADMIN_PASSWORD} ${ICECAST_RELAY_PASSWORD} ${PUBLIC_HOSTNAME} ${PORT}' \
  < /opt/radio/icecast.xml.template > /etc/icecast2/icecast.xml

icecast2 -c /etc/icecast2/icecast.xml -b

# Wait for Icecast to accept connections before starting the encoder.
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/status-json.xsl" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "Icecast did not become ready." >&2
  exit 1
fi

# Keep the stream worker in the foreground so the container restarts it
# automatically if the encoder exits.
exec python3 /opt/radio/stream.py
