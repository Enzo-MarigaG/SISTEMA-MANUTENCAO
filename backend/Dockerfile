FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm ci
RUN npm run build
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]