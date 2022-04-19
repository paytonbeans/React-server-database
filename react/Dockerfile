FROM ubuntu:latest

RUN apt update && apt install curl -y
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash && \
        apt install nodejs
RUN npm install -g yarn
ENV PUBLIC_URL "/project6"
RUN mkdir /app
WORKDIR /app