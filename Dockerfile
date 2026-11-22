FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages

# Prisma generate requires DATABASE_URL to be present, but makes no connection.
# Railway injects the real value at runtime.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
      bun install --frozen-lockfile && \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
      bun run db:generate

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "start"]
