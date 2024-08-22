# Stage 1: Build
FROM node:16 AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy application code
COPY . .

# Run unit tests
RUN npm test

# Stage 2: Production
FROM node:16

# Set working directory for production
WORKDIR /usr/src/app

# Copy only the necessary files from the builder stage
COPY --from=builder /usr/src/app ./

# Remove devDependencies to keep the image size small
RUN npm prune --production

# Install openssl for certificate generation
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Generate SSL certificate using your script
RUN chmod +x ./generate-cert.sh && ./generate-cert.sh

# Create data directory and set permissions
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app

EXPOSE 8443

# Create volume for persistent data
VOLUME /usr/src/app/data

# Switch to non-root user for security reasons
USER node

# Start the application
CMD ["node", "server.js"]
