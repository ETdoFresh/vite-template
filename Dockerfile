FROM node:20-alpine

# Install dependencies for native builds (node-pty) and dev tooling
RUN apk add --no-cache bash python3 make g++ pkgconf

WORKDIR /app

# Copy only package manifests first for better Docker layer caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY proxy/package*.json ./proxy/
COPY terminal/frontend/package*.json ./terminal/frontend/
COPY terminal/backend/package*.json ./terminal/backend/

# Install all workspaces (root, frontend, backend, proxy)
RUN npm run install:all

# Install codex
RUN npm install -g @openai/codex

# Copy the rest of the source
COPY . .

# Expose dev ports
EXPOSE 3000

# Add entrypoint to materialize ~/.codex/auth.json from env
COPY docker/codex-auth-bootstrap.sh /usr/local/bin/codex-auth-bootstrap.sh
RUN chmod +x /usr/local/bin/codex-auth-bootstrap.sh

# Start all services concurrently
ENTRYPOINT ["/usr/local/bin/codex-auth-bootstrap.sh"]
CMD ["npm", "start"]
