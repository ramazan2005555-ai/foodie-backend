#!/bin/bash
# Run seed then start server
npm run build
node dist/seed.js
node dist/main.js
