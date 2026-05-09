FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM node:24-alpine AS runtime
RUN addgroup -g 1234 -S app && adduser -u 1234 -S app -G app
WORKDIR /app
RUN mkdir -p /app/data && chown 1234:1234 /app/data
COPY --chown=1234:1234 --from=build /app/.output ./.output
COPY --chown=1234:1234 --from=build /app/src/features/shared/server/frigate/assets ./.output/server/assets/assets
USER 1234
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
