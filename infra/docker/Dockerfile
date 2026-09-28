# Build from the repo root:
#   docker build -f infra/docker/Dockerfile .
#   docker compose -f backend/docker-compose.yml --env-file backend/.env up -d

FROM node:22

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/diploy-core/package.json ./packages/diploy-core/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
