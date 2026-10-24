FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . ./

# The pinned Debian base image can lag its security repository. Keep PCRE2 at
# the Debian security-fixed revision without taking a broad runtime upgrade.
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade libpcre2-8-0 \
  && rm -rf /var/lib/apt/lists/*

# Production starts with Node directly; remove npm's bundled tooling and its
# unrelated dependency surface from the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/healthz').then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
