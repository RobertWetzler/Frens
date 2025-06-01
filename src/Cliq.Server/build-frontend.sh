#!/bin/bash
# Used for building the Cliq client and putting it in the server's wwwroot directory.
# Useful for testing HTTPS locally in dev, testing PWA install, etc.

# Set script to exit on any error
set -e

echo "Building Cliq client and server..."

# Build client (Expo web export)
echo "Building client..."
cd ../cliq.client
npm install
npx expo export -p web

# Copy exported client to server wwwroot
echo "Copying client build to server wwwroot..."
cd ../..
rm -rf src/Cliq.Server/wwwroot
cp -r src/cliq.client/dist src/Cliq.Server/wwwroot

echo "Build complete! Client exported and copied to Cliq.Server/wwwroot"