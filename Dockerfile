FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Dùng --legacy-peer-deps nếu dự án của bạn có conflict version
RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "start:dev"]