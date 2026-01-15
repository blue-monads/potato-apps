#!/bin/bash

set -e

echo "Building potato-apps"

DIST_DIR="dist"

for app in $(ls -d */); do
  if [ -f "$app/build.sh" ]; then
    echo "Building $app"
    $app/build.sh
  fi
done

for app in $(ls -d */); do
  if [ -f "$app/package.zip.spk" ]; then
    # copy to ../dist
    cp $app/package.zip.spk ../$DIST_DIR/$app.zip.spk
  fi
done
