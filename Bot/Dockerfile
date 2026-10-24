# YapBoard bot. No npm dependencies; reminders are kept in /app/data (mount a volume there).
# The SDK comes from YapinAssets as a second build context (docker compose passes it):
#   docker build --build-context sdk=../YapinAssets .
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json bot.js ./
COPY lib ./lib
COPY cogs ./cogs
# lib/yapper.js only re-exports ../../YapinAssets/yapper.js, which isn't in the image: put the SDK there instead.
COPY --from=sdk yapper.js ./lib/yapper.js
RUN mkdir data && chown node:node data
USER node
VOLUME /app/data
CMD ["node", "bot.js"]
