FROM node:16

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Install openssl for certificate generation
RUN apt-get update && apt-get install -y openssl

# Copy application code
COPY . .

# Generate SSL certificate
RUN chmod +x ./generate-cert.sh && ./generate-cert.sh

# Create data directory and set permissions
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app

EXPOSE 8443

# Create volume for persistent data
VOLUME /usr/src/app/data

# Switch to non-root user
USER node

# Start the application
CMD ["node", "server.js"]
