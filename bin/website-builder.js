#!/usr/bin/env node

/**
 * Dependencies.
 */

var fs = require('fs');
var exists = fs.existsSync;
var path = require('path');
var resolve = path.resolve;
var metalsmith = require('metalsmith');
var markdown = require('metalsmith-markdown');
var pageBuilder = require('metalsmith-page-builder');
var layouts = require('metalsmith-layouts');
var program = require('commander');
var colors = require('colors');
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');

/**
 * Helpers
 */
var logger = require('../lib/helpers/logger')('website-builder');
var debug = logger.debug;
var warn = logger.warn;
var error = logger.error;


/**
 * command and global options
 */
var command;
var options;

var dir;
var target;



/**
 * Default folders
 */

var ASSETS = 'assets';
var SASS = 'sass';
var LAYOUTS = 'layouts';
var CONTENT = 'content';
var STRUCTURE = 'structure';
var TARGET = 'build';
var ASSETS_TARGET = 'assets';
var SASS_TARGET = 'assets/css';


/**
 * Main executable configuration and usage.
 */

program
  .version(require('../package.json').version)
  .option('-w, --workdir <path>', 'base working directory (defaults to current working directory)')
  .option(
    '-t, --target <path>', 'target build directory;' +
    ' relative to working directory ( default is ./build)')
  .action(function(cmd, options) {
    command = cmd;
  });

/**
 * Build command configuration and usage
 */
program
  .command('build')
  // .alias('ex')
  .description('build website using structure files, layouts and contents')
  .option('-l, --layouts <path>', 'directory containing layouts; relative to working directory ( default is ./layouts )')
  .option(
    '-c, --content <path>', 'directory containing contents;' +
    ' relative to working directory ( default is ./content )')
  .option(
    '-s, --structure <path>', 'directory containing structure files;' +
    ' relative to working directory ( default is ./structure)')
  .action(build)
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('    # build using defaults:');
    console.log('    $ website-builder build');
    console.log();
    console.log('   # build using custom paths:');
    console.log('   $ website-builder -w /home/user/projects/website build --layout src/layout ' +
      '--content ./src/content --structure ./structure');
    console.log();
  });

/**
 * Assets command configuration and usage
 */
program
  .command('assets')
  // .alias('ex')
  .description('copy assets under source folder to destionation folder with no change ')
  .option('-a, --assets <path>', 'directory containing assets; relative to working directory ( default is ./assets) ')
  .option('-o, --assets-target <path>', 'target assets folder relative to build directory to copy assets to')
  .action(assets)
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('   # copy assets under src/assets to build/assets ' +
      '(build is default target, to change target use --target option):');
    console.log('   $ website-builder assets --assets src/assets -o assets ');
    console.log();
  });


/**
 * Sass command configuration and usage
 */
program
  .command('sass')
  // .alias('ex')
  .description('Build sass files')
  .option('-s, --sass <path>', 'directory containing sass files; relative to working directory ( default is ./scss)')
  .option('-o, --output-dir <path>', 'output directory relative to build directory to copy css output to')
  .action(assets)
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('   # build sass files under src/scss to build/assets/css ' +
      '(build is default target, to change target use --target option):');
    console.log('   $ website-builder assets --sass src/scss -o assets/css ');
    console.log();
  });


/**
 * Parse.
 */

program.parse(process.argv);

///Main command check
if (!process.argv.slice(2).length) {
  program.outputHelp(function(txt) {
    return colors.red(txt);
  });
  fatal('no command given!');
}

/**
 * Config.
 */

function build(options) {

  init();
  var _layouts = verifyPath(options.layouts || LAYOUTS);
  var _structures = verifyPath(options.structure || STRUCTURE);
  var _contents = verifyPath(options.content || CONTENT);

  debug('Bulding website using following directories:');
  debug('Content folder: %s', _contents);
  debug('Layout folder: %s', _layouts);
  debug('Structure folder: %s', _structures);
  configureNunjucks();

  buildPages();

  function buildPages() {

    var m = metalsmith(dir)
      .source(_contents)
      .use(markdown())
      .use(pageBuilder({
        structures: _structures, //structure files dir
      }))
      .use(layouts({
        engine: 'nunjucks',
        directory: _layouts
      }))
      // .use(sassBuilder())
      .destination(target)
      .build(function(err) {
        if (err) {
          fatal('Build failed', err);
        } else {
          debug('Successfully built to %s', target);
        }
      });



    /**
     *
     */
    function sass() {

      init();
      var _sass = verifyPath(options.sass || SASS);
      var _outputDir = options.outputDir || SASS_TARGET;

      var m = metalsmith(dir)
        .source(sass);

      var files = fs.readdirSync(_sass);
      var path = require('path');

      for (var i in files) {
        if (path.extname(files[i]) === '.scss') {
          m.use(sass({
            file: path.basename(files[i]),
            outputDir: _outputDir,
            outputStyle: 'compressed'
          }));
        }
      }

      m.destination(target)
        .build(function(err) {
          if (err) {
            fatal('Sass failed!', err);
          } else {
            debug('Sass files processed successfully');
          }
        });

    }
  }
}


/**
 *
 * Copies assets with no change under given output directory
 *
 * @param  {Object} options source/target options
 */
function assets(options) {

  init();
  var _assets = verifyPath(options.assets || ASSETS);
  var _assetsTarget = options.outputDir || ASSETS_TARGET;

  debug('Copying assets under %s over to target folder %s', _assets, _assetsTarget);

  metalsmith(dir)
    .use(assets({
      source: _assets,
      destination: _assetsTarget
    })).destination(target)
    .build(function(err) {
      if (err) {
        fatal('Assets failed!');
      } else {
        debug('Assets copied successfully!');
      }
    });
}

/**
 * Initialising global options
 */
function init() {
  dir = program.workdir || process.cwd();
  target = program.target || TARGET;

  debug('Working directory: %s', dir);
  debug('Build target: %s', target);
}


function verifyPath(cPath) {
  var path = resolve(dir, cPath);
  if (!exists(path)) {
    fatal('could not find folder ' + path);
  }

  return path;
}



function configureNunjucks(layouts) {
  var env = nunjucks.configure(layouts + '/templates', {
    watch: false
  });

  // helper to slugify strings
  env.addFilter('slug', function(content, language) {
    if ((language || 'us') === 'zh') {
      return content;
    }

    if (!content) {
      return content;
    }

    var spacesToDashes = content.split(' ').join('-').toLowerCase();
    var removeChars = spacesToDashes.replace(/[^a-zA-Z0-9\- ]/g, '');
    return removeChars;
  });

  // helper to un-slugify strings and sentence case
  // env.addFilter('unslug', function(content, language) {
  //   //do not modify chinese language
  //   if ((language || 'us') === 'cn') {
  //     return content;
  //   }
  //   var unslug = content.split('-').join(' ');
  //   return unslug.charAt(0).toUpperCase() + unslug.substr(1);
  // });

  env.addGlobal('now', function() {
    return new Date();
  });

  nunjucksDate.setDefaultFormat('DD MMMM YYYY');
  nunjucksDate.install(env);
}

/**
 * Log an error and then exit the process.
 *
 * @param {String} msg
 * @param {String} [stack]  Optional stack trace to print.
 */

function fatal(msg, stack) {

  error(msg);
  if (stack) {
    error(stack);
  }
  process.exit(1);
}

function isDev() {
  return process.argv[2] && process.argv[2] === 'dev';
}
