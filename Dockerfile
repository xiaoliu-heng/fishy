FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

WORKDIR /app
ENV NODE_ENV=production PORT=4173
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY server ./server
COPY dist ./dist
RUN mkdir .data && chown node:node .data
USER node
EXPOSE 4173
CMD ["node", "server/index.js"]
