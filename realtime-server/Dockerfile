FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src ./src

EXPOSE 4001
CMD ["npm", "start"]
