# --- Stage 1: Build Frontend ---
FROM node:20-alpine as frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Backend & Production Image ---
FROM node:20-alpine
WORKDIR /app

# Copy backend dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy backend source
COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-builder /app/dist ./server/public

# Expose backend port
EXPOSE 8000

# Start server
CMD ["node", "server/index.js"]
