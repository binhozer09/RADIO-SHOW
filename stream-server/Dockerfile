FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV PULSE_SERVER=127.0.0.1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium pulseaudio ca-certificates fonts-liberation xvfb x11vnc openbox novnc websockify && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY cloud-player.html ./
EXPOSE 8000
CMD ["npm", "start"]
