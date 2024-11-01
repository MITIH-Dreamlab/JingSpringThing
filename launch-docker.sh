#!/bin/bash

set -e

# Stop and remove existing container, including associated volumes
docker stop logseqXR || true
docker rm -v logseqXR || true

# Build the Docker image
echo "Building Docker image..."
if ! docker build -t logseq-xr-image .; then
    echo "Docker build failed. Please check the error messages above."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create a .env file with the necessary environment variables."
    exit 1
fi

# Print environment variables for debugging
echo "Environment variables from .env:"
cat .env

# Run the Docker container with GPU 0 enabled, correct environment variables, and volume mounts
echo "Running Docker container..."
if ! docker run -d --name logseqXR \
  --gpus "device=0" \
  -v "$(pwd)/data/markdown:/app/data/markdown" \
  -v "$(pwd)/settings.toml:/app/settings.toml:ro" \
  -p 8443:8443 \
  --env-file .env \
  logseq-xr-image; then
    echo "Failed to start Docker container. Please check the error messages above."
    exit 1
fi

# Verify environment variables and mounted files in container
echo "Verifying container setup..."
echo "Environment variables in container:"
docker exec logseqXR env | grep -E 'GITHUB_|RAGFLOW_|PERPLEXITY_|OPENAI_'
echo "Mounted settings.toml content:"
docker exec logseqXR cat /app/settings.toml

echo "Docker container is now running."
echo "Access the application at https://192.168.0.51:8443"
echo "WebSocket should be available at https://192.168.0.51:8443/ws"
echo "Note: You may see a security warning in your browser due to the self-signed certificate. This is expected for local development."

# Display container logs
echo "Container logs:"
docker logs -f logseqXR
