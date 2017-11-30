#!/usr/bin/env bash
set -x

echo "Running version bumps"
CURRENT_PKG_VER=`node -e "console.log(require('./package.json').version);"`
echo "Determining current version: ${CURRENT_PKG_VER}"
LINE="bumping version in package.json from ${CURRENT_PKG_VER} to"
PKG_VER_NEXT=$(standard-version --dry-run | grep 'package.json from' | awk -v FS="${LINE}" -v OFS="" '{$1 = ""; print}')
PKG_VER_NEXT="$(echo -e "${PKG_VER_NEXT}" | tr -d '[:space:]')"

# Run unit tests
npm test

if [ "$TRAVIS_BRANCH" = "master" ]; then
    if [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
        echo "This is a push build for master; attempting to bump version"
        npm run version
        git remote rm origin
        git remote add origin $GITHUB_URL_SECURED
        git push --follow-tags origin master

        #TODO(Nana): Decide if we want to publish this module or not
    fi
fi