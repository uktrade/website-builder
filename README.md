# website-builder
website-builder tool for building websites based on Metalsmith using Nunjucks template engine


## Install

```
npm install -g uktrade/website-builder
```

## Usage

```
# View help

 $website-builder --help

 Usage: website-builder [options] [command]


  Commands:

    clean              Clean target directory
    build [options]    build website using structure files, layouts and contents
    assets [options]   Copy asset files, optionally build sass files

  Options:

    -h, --help            output usage information
    -V, --version         output the version number
    -w, --workdir [path]  base working directory (defaults to current working directory)
    -t, --target [path]   target build directory; relative to working directory ( default is ./build)

```

```
# Build
 
 $ website-builder build --help

 Usage: build [options]

  build website using structure files, layouts and contents

  Options:

    -h, --help              output usage information
    -l, --layouts [path]    directory containing layouts; relative to working directory [./layouts]
    -c, --content [path]    directory containing contents; relative to working directory [./content]
    -s, --structure [path]  directory containing structure files; relative to working directory [./structure]

  Examples:

    # build using defaults:
    $ website-builder build

   # build using custom paths:
   $ website-builder -w /home/user/projects/website build --layout src/layout --content ./src/content --structure ./structure

```

```
# Assets
 
 $website-builder assets --help

  Usage: assets [options]

  Copy asset files, optionally build sass files

  Options:

    -h, --help                output usage information
    -a, --assets [path]       asset files directory; relative to working directory [./assets]
    -s, --sass <path>         directory containing sass files; relative to assets directory
    -o, --sass-output <path>  sass output directory relative to build directory to copy css output to

  Examples:

   # build assets files under src/assets to build/assets 
   #optionally build .scss files under src/assets/scss into build/assets/css 
   $ website-builder -t build/assets assets --sass ./scss -o ./css 
