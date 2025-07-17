# base image
FROM node:22.17.1-slim

WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm install
COPY . .

EXPOSE 5000

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
