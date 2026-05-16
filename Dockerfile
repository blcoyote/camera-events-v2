FROM oven/bun:1-alpine AS base

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
RUN apk add --no-cache openssl
RUN addgroup -g 1234 -S app && adduser -u 1234 -S app -G app
WORKDIR /app
RUN mkdir -p /app/data && chown 1234:1234 /app/data
COPY --chown=1234:1234 --from=build /app/.output ./.output
COPY --chown=1234:1234 --from=build /app/src/features/shared/server/frigate/assets ./.output/server/assets/assets
COPY --chown=1234:1234 entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
USER 1234
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", ".output/server"]
