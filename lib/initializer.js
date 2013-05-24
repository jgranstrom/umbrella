'use strict';
/**
 * Require modules
 */
var async = require('async'),
  utilities = require('./utilities');

/**
 * Create a initializer function from a raw initializer. Determine its asynchronous nature
 * and inject any dependencies. Async initializers are by the created function invoked with
 * the done-callback as expected. Sync initializers are wrapped with callback result instead of returning
 * to normalize behavior.
 * @param inject The inject function for dependency injection.
 * @param initializer The raw initializer of which to create a init function.
 * @returns {Function}
 */
function createInitializerFunction(inject, initializer) {
  // Return a function for this initializer passing any errors to the callback
  return function(callback) {
    if(utilities.determineAsync(initializer)) {
      // Get the asynchronous initialization wrapper with done callback, allow additional parameters (done-callback)
      var asyncInit = inject(initializer, false);

      // Make sure it's actually a function and was not invoked by injector
      if(typeof asyncInit !== 'function') {
        return callback(new Error('async initializer not invokable with callback, this may be caused by a ' +
          '"done"-component colliding with done-callback'));
      }

      // Make sure the returned wrapper function only has the done-callback parameter left after injection
      // Do not use length since the wrapper has no declared parameters, use special property 'exParamLength'
      if(asyncInit.exParamLength !== 1) {
        return callback(new Error('async initializers cannot take additional parameters except done-callback'));
      } else {
        // Invoke async initializer with callback
        asyncInit(callback);
      }
    } else {
      try {
        // Inject dependencies and ensure it is invoked and not having any trailing parameters
        inject(initializer, true);
        return callback(null);
      } catch(err) {
        return callback(err);
      }
    }
  };
}

/**
 * Require the umbrella initializer and inject-run it to get initializer order
 * to map each descriptor to provided function.
 * @param umbrellaInit The umbrella initializer helper.
 * @param inject The inject function for dependency injection.
 * @param func The function to call for each descriptor in order.
 * @returns {*} An array of processed descriptors to initializers.
 */
function initAndMapInitializers(umbrellaInit, inject, func) {
  // Umbrella initializer returns an array of descriptor objects
  return inject(umbrellaInit, true).map(func);
}

/**
 * Process a loaded initializer, determine the correct initializer for current environment
 * and create a initializer function.
 * @param env The current environment.
 * @param initializerBasePath The base path of the initializers.
 * @param inject The inject function for dependency injection.
 * @param initDescriptor The initialization descriptor coming from umbrella initializer.
 * @returns {*} A initializer function with callback for both async and sync initializers.
 */
function processInitializer(env, initializerBasePath, inject, initDescriptor) {
  var initializer = require(initializerBasePath + initDescriptor.component);

  // Determine correct initializer for current environment
  if(env === 'production') initializer = initializer.production || initializer;
  else initializer = initializer.development || initializer;

  // Initializer should now be a valid function, otherwise the initializer is incorrectly configured
  if(typeof initializer !== 'function') {
    throw new Error('umbrella encountered an incomplete initializer for ' +
      initDescriptor.component + ' component ');
  }

  return createInitializerFunction(inject, initializer);
}

/**
 * Initialize components specified by components object using each specific initializer
 * in the order and with the dependant components specified in each initializer.
 * This is done asynchronously since some initializer may be run async.
 *
 * @param env The running environment (development/production) to determine specialized initializer.
 * @param umbrellaInit The umbrella initializer helper.
 * @param initializerBasePath The base path of the initializers.
 * @param inject The inject function for dependency injection.
 * @param callback The callback for when initialization is done, is called according to convention with error
 */
module.exports = function(env, umbrellaInit, initializerBasePath, inject, callback) {
  // Run the umbrella initializer and process each initializer to inject dependencies
  var initializers = initAndMapInitializers(umbrellaInit, inject,
    processInitializer.bind(this, env, initializerBasePath, inject));

  // Now run all initializers in a sequence to guarantee order
  async.series(initializers, function(err) {
    return callback && callback(err);
  });
};