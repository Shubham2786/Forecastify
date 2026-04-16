#!/bin/bash
# script to stop the application
cd /home/ubuntu/forecastify
docker-compose down || true
