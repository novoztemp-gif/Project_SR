#!/usr/bin/env bash
# Builds a single standalone scanner-bridge.exe for Windows — bundles Node.js
# itself, so the client's PC needs nothing pre-installed (not even Node.js).
#
# Two steps, because pkg can't reliably package ESM (`import`) syntax:
#   1. esbuild bundles src/server.js + everything it imports into one
#      CommonJS file.
#   2. pkg packages that single file together with a Node runtime into one
#      Windows executable.
#
# Run from the scanner-bridge/ directory: ./build-exe.sh
# Output: dist-exe/scanner-bridge.exe
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist-exe
mkdir -p dist-exe

echo "==> Bundling to CommonJS…"
# fsevents is chokidar's macOS-only optional native binding, unreachable at
# runtime on Windows (chokidar itself guards it behind a platform check) —
# excluded here since esbuild can't bundle a native .node file anyway.
npx esbuild src/server.js \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --external:fsevents \
  --outfile=dist-exe/bundle.cjs

echo "==> Packaging into a Windows executable…"
npx pkg dist-exe/bundle.cjs --targets node18-win-x64 --output dist-exe/scanner-bridge.exe

echo "==> Done: dist-exe/scanner-bridge.exe"
ls -lh dist-exe/scanner-bridge.exe
