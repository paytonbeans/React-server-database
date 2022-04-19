FROM ubuntu:latest

RUN apt install nginx
RUN systemctl enable nginx nodejs
RUN service nginx restart
RUN npm install express --save