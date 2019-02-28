FROM node:8-alpine

RUN npm install alex --global

VOLUME /mnt

WORKDIR /mnt


ENTRYPOINT ["alex"]
CMD ["--help"]
