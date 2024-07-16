export PORT_MAPPING=8443:8443
docker build -t webxr-graph .

docker run -d --name logseqXR -p $PORT_MAPPING \
  -v $(pwd)/processed_files:/usr/src/app/data/processed_files:rw \
  webxr-graph

