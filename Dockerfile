# base image
FROM node:22.10.0-slim

WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm install
COPY . .

EXPOSE 2000

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
