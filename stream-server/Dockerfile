FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    icecast2 ffmpeg python3 curl gettext-base ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/radio
COPY icecast.xml.template /opt/radio/icecast.xml.template
COPY start.sh /opt/radio/start.sh
COPY stream.py /opt/radio/stream.py
RUN chmod +x /opt/radio/start.sh && mkdir -p /music

EXPOSE 8000
CMD ["/opt/radio/start.sh"]
