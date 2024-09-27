# Stage 1: Build the Frontend
FROM node:latest AS frontend-builder

WORKDIR /app

# Copy package files and vite config
COPY package.json pnpm-lock.yaml ./ 
COPY vite.config.js ./ 

# Copy the public assets
COPY data ./data

# Install pnpm globally
RUN npm install -g pnpm

# Clean PNPM store and install dependencies
RUN pnpm install 

# Build the frontend (this will output to /app/data/dist)
RUN pnpm run build

# Ensure the dist directory is created in the correct location and copy files
RUN mkdir -p /app/data/public/dist && \
    cp -R /app/data/dist/* /app/data/public/dist/ || true

# Stage 2: Build the Rust Backend
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04 AS backend-builder

# Install necessary dependencies for building Rust applications
RUN apt-get update && apt-get install -y \
    build-essential \
    gnupg2 \
    curl \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Rust using rustup
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set the default toolchain to stable
RUN rustup default stable

WORKDIR /usr/src/app

# Copy the Cargo.toml and Cargo.lock files to leverage Docker cache
COPY Cargo.toml Cargo.lock ./

# Copy the source code
COPY src ./src 

# Copy settings.toml
COPY settings.toml ./ 

# Build the Rust application in release mode for optimized performance
RUN cargo build --release

# Final stage: Create a minimal runtime image
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Install necessary runtime dependencies and nginx
RUN apt-get update && apt-get install -y \
    curl \
    libssl3 \
    nginx \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/data/public/dist /app/data/markdown

# Copy topics.csv file into the container
COPY data/topics.csv /app/data/topics.csv

# Copy the built Rust binary from the backend-builder stage
COPY --from=backend-builder /usr/src/app/target/release/webxr-graph /app/webxr-graph

# Copy the built frontend files from the frontend-builder stage
COPY --from=frontend-builder /app/data/public/dist /app/data/public/dist

# Copy settings.toml from the backend-builder stage
COPY --from=backend-builder /usr/src/app/settings.toml /app/settings.toml

# Copy the data directory
COPY data /app/data

# Set up a persistent volume for Markdown files to ensure data persistence
VOLUME ["/app/data/markdown"]

# Create directory for SSL certificates
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed SSL certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=192.168.0.51"

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Ensure proper permissions for nginx and application directories
RUN chown -R www-data:www-data /var/lib/nginx /app

# Expose HTTPS port
EXPOSE 8443

# Create a startup script that runs nginx and the Rust application
RUN echo '#!/bin/bash\nset -e\nnginx\nexec /app/webxr-graph' > /app/start.sh && chmod +x /app/start.sh

# Set the command to run the startup script
CMD ["/app/start.sh"]
