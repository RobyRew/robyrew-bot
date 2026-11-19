FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY sdk ./sdk
COPY src ./src
USER node
EXPOSE 8787
CMD ["node", "--experimental-strip-types", "src/main.ts"]
