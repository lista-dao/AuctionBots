FROM node:16-alpine

RUN mkdir /app
ADD . /app/
WORKDIR /app
RUN yarn install
