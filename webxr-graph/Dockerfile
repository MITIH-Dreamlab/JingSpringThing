FROM node:14
WORKDIR /usr/src/app
VOLUME /usr/src/app/data
COPY package*.json ./
RUN npm install
RUN apt-get update && apt-get install -y openssl
COPY . .
RUN chmod +x ./generate-cert.sh && ./generate-cert.sh
EXPOSE 8443
CMD ["node", "server.js"]

