#!/usr/bin/env node

/**
 * Dependencies.
 */

var fs = require('fs');
var exists = fs.existsSync;
var rmdir = require('rimraf');
var path = require('path');
var resolve = path.resolve;
var metalsmith = require('metalsmith');
var markdown = require('metalsmith-markdown');
var pageBuilder = require('metalsmith-page-builder');
var assets = require('metalsmith-assets');
var sass = require('metalsmith-sass');
var layouts = require('metalsmith-layouts');
var htmlMinifier= require('metalsmith-html-minifier');
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


/**
 * Default folders
 */

var ASSETS = './assets';
var LAYOUTS = './layouts';
var CONTENT = './content';
var STRUCTURE = './structure';
var TARGET = './build';


/**
 * Main executable configuration and usage.
 */

program
  .version(require('../package.json').version)
  .option('-w, --workdir [path]',
    'base working directory (defaults to current working directory)',
    process.cwd()
  )
  .option(
    '-t, --target [path]',
    'target build directory; relative to working directory ( default is ' + TARGET + ')',
    TARGET
  );


/**
 * Clean command configuration and usage
 */
program
  .command('clean')
  .description('Clean target directory')
  .action(clean);

/**
 * Build command configuration and usage
 */
program
  .command('build')
  .description('build website using structure files, layouts and contents')
  .option('-l, --layouts [path]',
    'directory containing layouts; relative to working directory [' + LAYOUTS + ']',
    LAYOUTS
  )
  .option(
    '-c, --content [path]',
    'directory containing contents; relative to working directory [' + CONTENT + ']',
    './content'
  )
  .option(
    '-s, --structure [path]',
    'directory containing structure files; relative to working directory [' + STRUCTURE + ']',
    './structure'
  )
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
  .description('Copy asset files, optionally build sass files')
  .option('-a, --assets [path]',
    'asset files directory; relative to working directory [' + ASSETS + ']',
    ASSETS
  )
  .option('-s, --sass <path>',
    'directory containing sass files; relative to assets directory')
  .option('-o, --sass-output <path>',
    'sass output directory relative to build directory to copy css output to'
  )
  .action(buildSass)
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('   # build assets files under src/assets to build/assets ');
    console.log('   #building .scss files under src/assets/scss into build/assets/css ');
    console.log('   $ website-builder -t build/assets assets --sass ./scss -o ./css ');
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

  verifyWorkdir();
  var _layouts = verifyPath(options.layouts);
  var _structures = verifyPath(options.structure);
  var _contents = verifyPath(options.content);

  debug('Bulding website using following directories:');
  debug('Content folder: %s', _contents);
  debug('Layout folder: %s', _layouts);
  debug('Structure folder: %s', _structures);
  configureNunjucks(_layouts);

  buildPages();

  function buildPages() {
    var m = metalsmith(program.workdir)
      .source(_contents)
      .use(markdown())
      .use(pageBuilder({
        structures: _structures, //structure files dir
      }))
      .use(layouts({
        engine: 'nunjucks',
        directory: _layouts
      }))
      .use(htmlMinifier())
      .clean(false)
      .destination(program.target)
      .build(function(err) {
        if (err) {
          fatal('Build failed', err);
        } else {
          debug('Successfully built to %s', program.target);
        }
      });

  }
}



/**
 *
 */
function buildSass(options) {

  verifyWorkdir();
  var _assets = verifyPath(options.assets);
  var _sass;
  var sassFiles;
  var _outputDir;
  if (options.sass) {
    _sass = verifyPath(path.join(_assets, options.sass));
    _outputDir = options.sassOutput;
    sassFiles = fs.readdirSync(_sass);
    debug('Sass files: %s', _sass);
    debug('Sass Output: %s', _outputDir);
  }

  var m = metalsmith(program.workdir)
    .source(_assets);

  if (options.sass) {
    for (var i in sassFiles) {
      if (path.extname(sassFiles[i]) === '.scss') {
        debug('Sass: %s', sassFiles[i]);
        m.use(sass({
          file: sassFiles[i],
          outputDir: _outputDir,
          outputStyle: 'compressed'
        }));
      }
    }
  }

  m.clean(false)
    .destination(program.target)
    .build(function(err) {
      if (err) {
        fatal('Sass failed!', err);
      } else {
        debug('Sass files processed successfully');
      }
    });

}


function clean(options) {
  var target = resolve(program.workdir, program.target);
  if (!exists(target)) {
    debug('No target to clean');
  } else {
    debug('Clean: %s', target);
    rmdir(path.join(target, '*'), function(error) {
      if (error) {
        fatal('Failed cleaning', error);
      }
    });
  }
}

function verifyPath(cPath) {
  if (!cPath) {
    fatal('path not given!');
  }
  var path = resolve(program.workdir, cPath);
  if (!exists(path)) {
    fatal('could not find folder ' + path);
  }

  return cPath;
}

function verifyWorkdir() {
  var path = resolve(program.workdir);
  if (!exists(path)) {
    fatal('could not find folder ' + path);
  }
}


function configureNunjucks(layouts) {
  var env = nunjucks.configure(layouts, {
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
