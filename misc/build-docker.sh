#!/bin/sh
set -eu

# Build locally. Publishing and release tags remain a human action.
IMAGE_NAME="ghcr.io/theophilediot/garage-webui"
PACKAGE_VERSION=$(node -p 'JSON.parse(require("fs").readFileSync("package.json", "utf8")).version')
docker build -t "$IMAGE_NAME:$PACKAGE_VERSION" .
