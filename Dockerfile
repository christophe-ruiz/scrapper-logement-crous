FROM ghcr.io/puppeteer/puppeteer:latest
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./
COPY logements_precedents.json ./
RUN npm ci
COPY . .
EXPOSE ${PORT_DEPLOY}
CMD ["node", "index.js"]
