#!/bin/bash
# script to start the application
cd /home/ec2-user/forecastify
# Build image manually to avoid Buildx compatibility issues with Compose
docker build -t forecastify:latest .
# Start the container
docker compose up -d
