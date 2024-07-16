export PORT_MAPPING=8443:8443
docker build -t webxr-graph .
docker run -d -p 8443:8443 -v $(pwd)/processed_files:/usr/src/app/data/processed_files webxr-graph
export PORT_MAPPING=8443:8443

docker run -d --name logseqXR:latest -p $PORT_MAPPING \
  -v $(pwd)/processed_files:/usr/src/app/data/processed_files:rw \
  webxr-graph
