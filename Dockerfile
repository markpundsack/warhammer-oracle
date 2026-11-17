FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build:docker

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist/ dist/
# Not in git (personal-use terms): the deploy script copies it in; an empty directory otherwise.
COPY --from=build /app/src/data/private/ private/
EXPOSE 8080
CMD ["node", "dist/http.js"]
