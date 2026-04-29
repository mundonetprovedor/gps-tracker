FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy backend source
COPY backend/ .

# Copy dashboard to be served as static files
COPY dashboard/ ../dashboard/

EXPOSE 3000

CMD ["node", "server.js"]
