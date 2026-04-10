#stage 1 of the dockerfile
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

#stage 2
FROM gcr.io/distroless/nodejs20
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Copy necessary files for standalone mode
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]