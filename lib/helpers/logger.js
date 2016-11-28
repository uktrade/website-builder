'use strict';

var deb = require('debug');
var colors = require('colors');
var util = require('util');

module.exports = Logger;

/**
 * Creates a new logger for given library name allowing warn and debug and error level logs.
 *
 * All logger names are prefixed with iigb:
 *
 * @param {String} name name of the library doing logging
 */
function Logger(name) {
  var debug = deb(name);
  // set all output to go via console.info
  // overrides all per-namespace log settings
  debug.log = console.info.bind(console);


  function error() {
    console.error(prefix('ERROR').bold.red, util.format.apply(util, arguments));
  }

  function warn() {
    console.warn(prefix('WARN').bold.yellow, util.format.apply(util, arguments));
  }


  function prefix(prefix) {
    //Prepend prefix log string
    return '  ' + name + ' [' + prefix + '] ';
  }

  return {
    debug: debug,
    warn: warn,
    error: error
  };
}
