FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM base AS runtime
RUN addgroup -g 1234 -S app && adduser -u 1234 -S app -G app
WORKDIR /app
COPY --chown=1234:1234 --from=deps /app/node_modules ./node_modules
COPY --chown=1234:1234 --from=build /app/dist ./dist
COPY --chown=1234:1234 --from=build /app/package.json ./
COPY --chown=1234:1234 --from=build /app/vite.config.ts ./
COPY --chown=1234:1234 --from=build /app/vite-plugin-sw.ts ./
COPY --chown=1234:1234 --from=build /app/tsconfig.json ./
COPY --chown=1234:1234 --from=build /app/src ./src
COPY --chown=1234:1234 --from=build /app/src/features/shared/server/frigate/assets ./dist/server/assets/assets
USER 1234
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "vite", "preview", "--port", "3000", "--host"]
