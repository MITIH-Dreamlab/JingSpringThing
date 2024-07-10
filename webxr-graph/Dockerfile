# Use the official Node.js 14 image as the base
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Install OpenSSL for certificate generation
RUN apt-get update && apt-get install -y openssl

# Copy the rest of the application code
COPY . .

# Generate self-signed certificate
RUN chmod +x ./generate-cert.sh && ./generate-cert.sh

# Expose the HTTPS port
EXPOSE 8443

# Copy the .env file for environment variables
COPY .env .env

# Command to run the application
CMD ["node", "server.js"]
