FROM oven/bun:1-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS base

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runtime
RUN addgroup -g 1234 -S app && adduser -u 1234 -S app -G app
WORKDIR /app
RUN mkdir -p /app/data && chown 1234:1234 /app/data
COPY --chown=1234:1234 --from=build /app/.output ./.output
COPY --chown=1234:1234 --from=build /app/src/features/shared/server/frigate/assets ./.output/server/assets/assets
USER 1234
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", ".output/server"]
