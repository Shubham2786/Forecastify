#!/bin/bash
# script to stop the application
cd /home/ec2-user/forecastify
docker compose down || true
