#!/bin/bash

#Exit on error
set -oe pipefail

if [[ -n $(git status --porcelain) ]]; then
    echo "Repo is dirty" && \
    echo "Please stash or commit your changes before releasing" && \
    exit 1;
fi

function switch_to() {
    echo "Switching to $1"
    git checkout --quiet $1
}

function update() {
    switch_to $1
    echo "Pulling latest $1"
    git pull --rebase --quiet
}

function merge_release_to() {
   switch_to $1
   echo "Merging release to $1"
   git merge --quiet --no-edit --no-ff $releaseBranch
}


# current Git branch
branch=$(git rev-parse --abbrev-ref HEAD)

# major|minor|patch
newVersion=$1
[ -z $1 ] && echo "Please speficy version (major|minor|patch)" && exit 1

# establish branch and tag name variables
devBranch="develop"
masterBranch="master"

#Fetch remote trackers for releasing
echo "Fetching remote branches (git fetch)"
git fetch --quiet

update $devBranch

#Bump version up
version=$(npm version "$1" --no-git-tag-version)
echo "Bumped version to $version"
releaseBranch="release/$version"

# create the release branch from develop branch
echo "Creating release branch $releaseBranch from $devBranch"
git checkout --quiet -b $releaseBranch

# commit version number increment
git commit -am "$version"

update $masterBranch
merge_release_to $masterBranch

# create tag for new version from -master
git tag $version

merge_release_to $devBranch

# remove release branch
git branch -d $releaseBranch

#Atomic ensures nothing is pushed if any of the repos fails to push
git push --atomic origin $devBranch $masterBranch $version

#switch back to branch you started
switch_to $branch


