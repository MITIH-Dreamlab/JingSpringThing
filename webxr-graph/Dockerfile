FROM node:14
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN apt-get update && apt-get install -y openssl
COPY . .
COPY .env .

RUN chmod +x ./generate-cert.sh && ./generate-cert.sh

# Remove these lines as they might conflict with the VOLUME instruction
# RUN mkdir -p /usr/src/app/data/processed_files/markdown
# RUN chown -R node:node /usr/src/app/data

EXPOSE 8443

# Move the VOLUME instruction here
VOLUME /usr/src/app/data

USER node
CMD ["node", "server.js"]

