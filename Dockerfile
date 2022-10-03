# syntax=docker/dockerfile:1

FROM node:alpine

WORKDIR /app

RUN apk add ttf-dejavu

COPY --link package.json .
COPY --link yarn.lock .
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn/v6 \
    yarn install --frozen-lockfile

COPY --link prisma .
RUN yarn prisma generate

COPY --link . .

RUN yarn build
ENTRYPOINT yarn prisma migrate deploy && yarn register && yarn start
