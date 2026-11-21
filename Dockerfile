FROM node:26-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/src

# Public product repos. The bot folders stay in those repos; this image checks them out beside this app.
RUN git clone --depth 1 https://github.com/RobyRew/mapswitch.git \
  && git clone --depth 1 https://github.com/RobyRew/spotify-versions-history.git \
  && git clone --depth 1 https://github.com/RobyRew/linkedin-pro-ios.git \
  && git clone --depth 1 https://github.com/RobyRew/calendar-event-generator.git \
  && git clone --depth 1 https://github.com/RobyRew/powerpoint-extractor.git \
  && git clone --depth 1 https://github.com/RobyRew/chat-converter.git \
  && git clone --depth 1 https://github.com/RobyRew/Doorline.git \
  && git clone --depth 1 https://github.com/RobyRew/portfolio.git \
  && mkdir -p XCode \
  && git clone --depth 1 https://github.com/RobyRew/pacetimer.git XCode/PaceTimer \
  && npm install --prefix chat-converter --no-audit --no-fund zod tsx

# bibletype is a private repo. biserica has no remote. Both ship in this image as the bot slices only.
COPY image/bibletype /opt/src/bibletype
COPY image/biserica /opt/src/biserica

WORKDIR /opt/src/robyrew-bot
COPY package.json package-lock.json ./
COPY sdk ./sdk
COPY src ./src
RUN npm install --no-audit --no-fund \
  && chown -R node:node /opt/src

USER node
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
