'use strict';
/**
 * Require modules.
 */
var fs = require('fs');

module.exports = {
  /**
   * Get the parameters of a function in an array.
   *
   * @param func The function for which to return the parameters.
   * @returns {Array} The parameters as an array of strings.
   */
  getFunctionParameters: function(func) {
    var argString = func.toString().match(/^\s*function\s*?\((.*?)\)/)[1].trim();
    if(!argString.length) return [];

    return argString.split(',').map(function(elem) {
      return elem.trim();
    });
  },

  /**
   * Determine if a function is async according to the umbrella initializer convention of having a
   * parameter named 'done' last in the function declaration. If a parameter named 'done' is present in the
   * declaration but not placed last a warning will be issued since it is not recommended for those functions.
   *
   * @param func The function for which to determine if it is asynchronous or synchronous according to umbrella.
   * @returns {boolean} True if function parameters ends with 'done', otherwise false.
   */
  determineAsync: function(func) {
    var args = module.exports.getFunctionParameters(func),
      isAsync = Boolean(args.length && args.pop() === 'done');
    if(!isAsync && (args.indexOf('done') + 1)) { // Detect possible mistake that may cause severe hard to find issues
      console.warn('using "done" as parameter name for potential asynchronous function without having it last and ' +
        'the function will therefore be run synchronously, this might not be the intended and is not recommended.');
    }
    return isAsync;
  },

  /**
   * Check if a path exists and is a directory.
   * @param path The path to check
   * @returns True if directory exists, otherwise false.
   */
  folderExists: function(path) {
    return fs.existsSync(path) && fs.statSync(path).isDirectory();
  },

  /**
   * Map across each file in folder synchronously.
   * @param path The path of the directory.
   * @param callback Callback to call for each file.
   */
  mapAllFilesSync: function(path, callback) {
    fs.readdirSync(path).forEach(callback);
  },

  /**
   * Create an object of injection components both internal and user provided external.
   * Internals are accessed using a preceeding $-sign. All internal components may not
   * all be available if accessed too early, trying to access such components will raise an error.
   * External components will be prioritized before internal components but collisions will cause a warning.
   *
   * @param externalComponents The external objects to add.
   * @param internalComponents The internal object to add.
   */
  createInjectionComponents: function(externalComponents, internalComponents) {
    var obj = {};

    Object.keys(externalComponents).forEach(function(key) {
      Object.defineProperty(obj, key, {
        get: function() { return externalComponents[key]; },
        configurable: false,
        enumerable: true
      });
    });

    Object.keys(internalComponents).forEach(function(key) {
      var actKey = '$' + key;

      // Do not override user provided components
      if(typeof obj[actKey] === 'undefined') {
        Object.defineProperty(obj, '$' + key, {
          get: function() {
            if(internalComponents[key] === null) {
              throw new Error('umbrella internal component %s accessed too early when not yet initialized.', key);
            } else {
              return internalComponents[key];
            }
          },
          configurable: false,
          enumerable: true
        });
      } else {
        // Warn however if user adds components which override umbrella internals
        console.warn('user provided component %s overrides umbrella internals', key);
      }
    });

    return obj;
  },

  /**
   * Create a initializer description object from a component initializer.
   * This helper is used to support simple extension of initialization describers in the future.
   *
   * @param component The component initializer name.
   * @returns {{component: *}} A descriptor object for umbrella initializer.
   */
  describeInitializer: function(component) {
    return { component: component };
  },

  /**
   * Expose a set of internal properties on an api object as .internal sub-property.
   * The sub-property and the internal objects will be non-configurable and read-only.
   *
   * @param api The object on which to augment the internals exposure.
   * @param internals The internal objects to expose.
   */
  exposeInternals: function(api, internals) {
    Object.defineProperty(api, 'internal', {
      value: {},
      enumerable: true,
      configurable: false,
      writable: false
    });
    Object.keys(internals).forEach( function(key) {
      Object.defineProperty(api.internal, key, {
        // Read only getter to support for later internal changes
        get: function() { return internals[key]; },
        enumerable: true,
        configurable: false
      });
    });
  }
};