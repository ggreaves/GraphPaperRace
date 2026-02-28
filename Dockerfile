# Use the official lightweight Node.js 18 image.
# https://hub.docker.com/_/node
FROM node:18-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package.json ./

# Install production dependencies.
RUN npm install

# Copy local code to the container image.
COPY . ./

# Run the web service on container startup.
CMD [ "npm", "start" ]
