FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
