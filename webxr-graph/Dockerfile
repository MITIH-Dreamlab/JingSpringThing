FROM node:14
WORKDIR /usr/src/app
VOLUME /usr/src/app/data
COPY package*.json ./
RUN npm install
RUN apt-get update && apt-get install -y openssl
COPY . .
RUN chmod +x ./generate-cert.sh && ./generate-cert.sh

# Add these lines to ensure proper permissions
RUN mkdir -p /usr/src/app/data/processed_files/markdown
RUN chown -R node:node /usr/src/app/data

EXPOSE 8443
USER node
CMD ["node", "server.js"]
