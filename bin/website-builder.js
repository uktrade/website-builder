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
var sass = require('metalsmith-sass');
var layouts = require('metalsmith-layouts');
var htmlMinifier= require('metalsmith-html-minifier');
var program = require('commander');
var colors = require('colors');
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var Jasmine = require('jasmine');
var JasmineConsoleReporter = require('jasmine-console-reporter');
var reporter = new JasmineConsoleReporter({
      colors: 1,           // (0|false)|(1|true)|2
      cleanStack: 1,       // (0|false)|(1|true)|2|3
      verbosity: 4,        // (0|false)|1|2|(3|true)|4
      listStyle: 'indent', // "flat"|"indent"
      activity: false
});

/**
 * Helpers
 */
var logger = require('../lib/helpers/logger')('website-builder');
var debug = logger.debug;
var error = logger.error;


/**
 * Default options
 */

var ASSETS = './assets';
var LAYOUTS = './layouts';
var CONTENT = './content';
var STRUCTURE = './structure';
var TARGET = './build';
var TESTS = './spec';
var DEV='false';


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

program
  .command('test')
  .description('Run unit tests under given test directory using Jasmine')
  .option(
    '-d, --directory [path]',
    'directory containing test files in the format *.spec.js [' + TESTS + ']',
    TESTS
  )
  .action(runTests);




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
  .option(
    '-d, --dev [true|false]',
    'set dev flag for sourcemap and optimisation for js and sass [' + DEV + ']',
    DEV
  )
  .option('-s, --sass <path>',
    'directory containing sass files; relative to assets directory')
  .option('-o, --sass-output <path>',
    'sass output directory relative to build directory to copy css output to'
  )
  .action(buildAssets)
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

function runTests(options) {
  var _directory = verifyPath(options.directory);
  var jasmine = new Jasmine();
  /* jshint ignore:start */
  jasmine.loadConfig({
        spec_dir: _directory,
        spec_files: [
                  '**/*.[sS]pec.js',
              ],
        helpers: [
                  'helpers/**/*.js'
              ]
  });

  jasmine.addReporter(reporter);

  jasmine.execute();
  /* jshint ignore:end*/
}


/**
 *
 */
function buildAssets(options) {

  verifyWorkdir();
  var dev=options.dev == "true" ? true : false;
  debug('Dev flag is', dev);
  var _assets = verifyPath(options.assets);


  var m = metalsmith(program.workdir)
    .source(_assets);

  if (options.sass) {
    var _sass = verifyPath(path.join(_assets, options.sass));
    var _outputDir = options.sassOutput;
    var sassFiles = fs.readdirSync(_sass);
    debug('Sass files: %s', _sass);
    debug('Sass Output: %s', _outputDir);

    for (var i in sassFiles) {
      if (path.extname(sassFiles[i]) === '.scss') {
        debug('Sass: %s', sassFiles[i]);
        m.use(sass({
          file: sassFiles[i],
          outputDir: _outputDir,
          outputStyle: dev ? 'expanded': 'compressed',
          sourceMap: dev,
          sourceMapContents: dev// This will embed all the Sass contents in your source maps.
        }));
      }
    }
  }

  m.clean(false)
    .destination(program.target)
    .build(function(err) {
      if (err) {
        fatal('Assets failed!', err);
      } else {
        debug('Asset files processed successfully');
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
    fatal('could not find ' + path);
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
