FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb x11vnc openbox xterm novnc websockify xfonts-base fonts-dejavu-core \
    ca-certificates bash procps curl nano vim-tiny htop git python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./package.json
RUN npm install --omit=dev
COPY server.js ./server.js
COPY index.html ./index.html
COPY remote.html ./remote.html
EXPOSE 8000
CMD ["npm", "start"]