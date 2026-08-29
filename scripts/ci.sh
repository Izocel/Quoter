#!/bin/bash
set -e

rm -rf node_modules
rm -f package-lock.json

npm install
npm run build