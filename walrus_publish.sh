# Copyright (c) Mysten Labs, Inc.
# SPDX-License-Identifier: Apache-2.0
#!/bin/bash
# Publishes the landing page to walrus sites.
echo "Building site builder..." && \
cd ../walrus-sites/ || { echo "Failed to change directory"; exit 1; } && \
echo "Current directory: $(pwd)" && \
cargo build --release && \
cd ../promise-zk/my-mint/ && \
echo "Current directory: $(pwd)" && \
echo "Building promise web page with vite" && \
npm run build
# echo "Creating temporary landing page directory..." && \
# mkdir temp-landing-page && \
# cp -r portal/common/static/* temp-landing-page && \
# rm temp-landing-page/index.html && \
# mv temp-landing-page/index-sw-enabled.html temp-landing-page/index.html && \
# rm temp-landing-page/{404-page.template.html,sw.js,walrus-sites-portal-register-sw.js} && \
# echo "Publishing landing page to walrus sites..."
cd ../../walrus-sites/ && \
echo "Current directory: $(pwd)" && \
./target/release/site-builder --config \
site-builder/assets/builder-example.yaml publish ../promise-zk/my-mint/dist/ \
# > publish-result.log
echo "Cleaning up..."
# rm -rf temp-landing-page
echo "Done."
