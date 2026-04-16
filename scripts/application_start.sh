#!/bin/bash

cd /home/ec2-user/forecastify

aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 360121241545.dkr.ecr.eu-west-1.amazonaws.com

docker pull 360121241545.dkr.ecr.eu-west-1.amazonaws.com/forecastify:latest

docker compose down || true
docker compose up -d