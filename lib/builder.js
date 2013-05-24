'use strict';
/**
 * Require modules.
 */
var fs = require('fs'),
  path = require('path');

/**
 * Recursively build a dependency object with the same structure as the provided directory
 * e.g. for routes:
 * /routes/index.js will be available at routes.index,
 * /routes/sub/other.js will be available at routes.sub.other
 *
 * Note: We allow for synchronous file read since this is initialization and routing cannot continue
 *       until all route modules are loaded. Thus this may only be used during initialization.
 *
 * @param dir The directory on which to build the object.
 * @param object The initial object to build upon
 * @param [process] An optional process that will map across each module.
 * @returns The built dependency object.
 */
var buildDependancyObject = function(dir, object, process) {
  fs.readdirSync(dir).forEach(function(file) {
    if(fs.statSync(dir + file).isDirectory()) {
      object[file] = buildDependancyObject(dir + file + '/', {}, process);
    } else {
      var m = require(dir + '/' + file);
      object[path.basename(file, path.extname(file))] = process ? process(m) : m;
    }
  });
  return object;
};

module.exports = {
  /**
   * Build a dependency object and inject dependencies for each of the built objects. Dependencies are injected
   * according to the injectDependencies() function specification.
   *
   * @param path The path on which to built the object.
   * @param inject The injector processor function to call for each dependent component.
   * @returns {} The built dependency object.
   */
  buildAndProcess: function(path, inject) {
      return buildDependancyObject(path, {}, function(object) {
        if(typeof object === 'function') return inject(object);
        else return object;
    });
  }
};