#!/bin/sh
set -eu

: "${ICECAST_SOURCE_PASSWORD:?Configure ICECAST_SOURCE_PASSWORD}"
: "${ICECAST_ADMIN_PASSWORD:?Configure ICECAST_ADMIN_PASSWORD}"
: "${ICECAST_RELAY_PASSWORD:=${ICECAST_SOURCE_PASSWORD}}"
: "${PUBLIC_HOSTNAME:=localhost}"

export ICECAST_RELAY_PASSWORD PUBLIC_HOSTNAME
envsubst '${ICECAST_SOURCE_PASSWORD} ${ICECAST_ADMIN_PASSWORD} ${ICECAST_RELAY_PASSWORD} ${PUBLIC_HOSTNAME}' \
  < /opt/radio/icecast.xml.template > /etc/icecast2/icecast.xml

icecast2 -c /etc/icecast2/icecast.xml -b

# Keep the stream worker in the foreground so the container restarts it
# automatically if the encoder exits.
exec python3 /opt/radio/stream.py
