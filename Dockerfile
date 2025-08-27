FROM node:20-alpine

# Install dependencies for file watching
RUN apk add --no-cache bash

# Set up monitor directory
WORKDIR /monitor
COPY monitor/package*.json ./
RUN npm install

# Copy monitor script
COPY monitor/monitor.js ./

# Copy application files to monitor directory
COPY package*.json ./
COPY frontend ./frontend
COPY backend ./backend
COPY service ./service

# Create app and volume directories
RUN mkdir -p /app /volume

# Start the monitor service
CMD ["node", "monitor.js"]