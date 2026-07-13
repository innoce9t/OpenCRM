# ---- build the client ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: Node server that serves the API + built client ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
# Cloud Run injects PORT (default 8080); the server reads process.env.PORT.
EXPOSE 8080
CMD ["node", "server/index.js"]
