FROM node:8-alpine

RUN apk --update add \
  unrar 

# where to check
VOLUME [ "/watch" ]

ADD . /app
WORKDIR /app

ENV ENVIRONMENT=production

RUN npm install --only=production
CMD [ "npm", "start" ]