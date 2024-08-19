#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo ".env file not found"
    exit 1
fi

# Check if RAGFLOW_API_KEY is set
if [ -z "$RAGFLOW_API_KEY" ]; then
    echo "RAGFLOW_API_KEY is not set in .env file"
    exit 1
fi

export PORT_MAPPING=8443:8443

# Build the Docker image
docker build -t webxr-graph .

# Run the Docker container
docker run -d --name logseq3D \
    -p $PORT_MAPPING \
    -v $(pwd)/processed_files:/usr/src/app/data/processed_files:rw \
    -e RAGFLOW_API_KEY="$RAGFLOW_API_KEY" \
    webxr-graph
