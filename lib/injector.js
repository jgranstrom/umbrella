'use strict';
/**
 * Require modules.
 */
var utilities = require('./utilities');

module.exports = {
  /**
   * Create a inject function for a specific context and compnoents
   * @param context The context on which to apply the injected functions.
   * @param injectComponents The components to use for dependency injection.
   * @returns {Function} A inject function to use for injecting dependencies for this context.
   */
  create: function(context, injectComponents) {
    /**
     * Create a function which encapsulates the provided func, with the dependencies specified injected
     * If the function has only dependencies as parameters, the function will be invoked with the dependencies
     * injected and the result will be return. If the function has more parameters than dependencies a new function
     * will be returned where the dependencies are injected and that takes the additional parameters of the original
     * function as parameters. However if mustInvoke is set any additional parameters are disallowed and will
     * throw exception.
     *
     * @param func The function on which to inject dependencies.
     * @param mustInvoke The injection must cause an invocation, exceeding parameters beyond dependencies will throw.
     * @returns {Function|Object} A wrapper function if parameters exceed dependencies, or the result of invoking the
     * function otherwise.
     */
    return function(func, mustInvoke) {
        var args = utilities.getFunctionParameters(func),
          injectArgs = [];

        for(var i = 0; i < args.length; i++) {
          if(injectComponents[args[i]]) {
            injectArgs.push(injectComponents[args[i]]);
          } else {
            break;
          }
        }

        if(i < args.length) {
          // Make sure additional parameters are allowed
          if(mustInvoke) {
            throw new Error('dependency injection must invoke, additional parameters not allowed.');
          }

          // There are more parameters than dependencies, create a wrapper function with only dependencies injected
          var wrapper = function() {
            // arguments are here expected to be the additional arguments to the middleware
            // The middleware wrapper function is expected to be called at application initialization time
            return func.apply(context, injectArgs.concat([].slice.call(arguments)));
          };

          // Add a custom length property telling the number of additional parameters
          Object.defineProperty(wrapper, 'exParamLength', {
            value: args.length - i, // The number of parameters beyond dependencies
            enumerable: false,
            configurable: true,
            writable: false
          });

          return wrapper;
        } else {
          return func.apply(context, injectArgs);
        }
      };
    }
};