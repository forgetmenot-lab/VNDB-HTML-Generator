FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js .
COPY vndb_tool.html .
EXPOSE 3737
CMD ["node", "server.js"]
