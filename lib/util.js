'use strict';
/**
 * Require modules.
 */
var path = require('path'),
  fs = require('fs');

module.exports = {
  /**
   * Return a function wrapping the provided function with provided 'this'-object as context and
   * the rest of the parameters to objectProxy() as arguments to the inner function.
   *
   * @param object The object to use a 'this'.
   * @param func The function to wrap.
   * @returns {Function} The wrapping function.
   */
  objectProxy: function(object, func /*, additional arguments will be passed on to func */) {
    var args = arguments;
    return function() {
      // Remove first two arguments and pass the rest on to func
      func.apply(object, [].slice.call(args, 2));
    };
  },

  /**
   * Recursively build a dependancy object with the same structure as the provided directory
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
   * @returns {Object} The built dependancy object.
   */
  buildDependancyObject: function(dir, object, process) {
    fs.readdirSync(dir).forEach(function(file) {
      if(fs.statSync(dir + file).isDirectory()) {
        object[file] = module.exports.buildDependancyObject(dir + file + '/', {}, process);
      } else {
        var m = require(dir + '/' + file);
        object[path.basename(file, path.extname(file))] = process ? process(m) : m;
      }
    });

    return object;
  },

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
   * Create a function which encapsulates the provided func, with the dependencies specified injected
   * If the function has only dependencies as parameters, the function will be invoked with the dependencies
   * injected and the result will be return. If the function has more parameters than dependencies a new function
   * will be returned where the dependencies are injected and that takes the additional parameters of the original
   * function as parameters.
   *
   * @param func The function on which to inject dependencies.
   * @param umbrella The umbrella object doing the injection.
   * @returns {Function|Object} A wrapper function if parameters exceed dependencies, or the result of invoking the
   * function otherwise.
   */
  injectDependencies: function(func, umbrella) {
    var args = module.exports.getFunctionParameters(func),
      injectArgs = [];

    for(var i = 0; i < args.length; i++) {
      if(umbrella.components[args[i]]) {
        injectArgs.push(umbrella.components[args[i]]);
      } else {
        break;
      }
    }

    if(i < args.length) {
      // There are more parameters than dependencies, return a wrapper function with only dependencies injected
      return function() {
        // arguments are here expected to be the additional arguments to the middleware
        // The middleware wrapper function is expected to be called at application initialization time
        return func.apply(umbrella.app, injectArgs.concat([].slice.call(arguments)));
      };
    } else {
      return func.apply(umbrella.app, injectArgs);
    }
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
   * Build a dependency object and inject dependencies for each of the built objects. Dependencies are injected
   * according to the injectDependencies() function specification.
   *
   * @param path The path on which to built the object.
   * @param umbrella The umbrella object for which to inject component dependencies.
   * @returns {Object} The built dependency object.
   */
  buildAndInject: function(path, umbrella) {
    return module.exports.buildDependancyObject(path, {}, function(object) {
      if(typeof object === 'function') return module.exports.injectDependencies(object, umbrella);
      else return object;
    });
  }
};