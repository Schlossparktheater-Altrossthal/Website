FROM node:20-slim

ARG NODE_ENV=production

ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package.json ./
RUN if [ "$NODE_ENV" = "production" ]; then npm install --omit=dev; else npm install; fi

COPY src ./src

EXPOSE 4001
CMD ["npm", "start"]
