docker build -t webxr-graph .
docker run -d -p 8443:8443 -v $(pwd)/processed_files:/usr/src/app/data/processed_files webxr-graph
