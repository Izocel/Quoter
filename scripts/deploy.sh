#!/bin/bash
set -e

echo "Starting deployment..."

echo "Installing dependencies..."
npm install

echo "Building the project..."
npm run build

echo "Deploying to GitHub Pages..."
gh-pages -d dist

echo "Deployment completed successfully."