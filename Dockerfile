# base image
FROM node:22.20.0-slim

WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm install
COPY . .

EXPOSE 5000

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
