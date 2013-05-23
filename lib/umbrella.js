'use strict';
/**
 * Required modules.
 */
var utilities = require('./util'),
  express = require('express'),
  http = require('http'),
  path = require('path'),
  async = require('async');

/**
 * Umbrella specific configuration and initialization objects.
 */
var config = {
  all: null,
  dev: null,
  pro: null
  },
  umbrellaInit = null, // Will after bootstrapping contain the main umbrella initializer
  umbrellaRoutes = null, // Will after bootstrapping contain the routes config
  injectComponents = null; // Will contain an object for getting components to inject

/**
 * Constants.
 */
var constants = { CONFIG_PATH: '/config' },
  constants = {
  CONFIG_PATH: constants.CONFIG_PATH,
  ENVIRONMENTS_PATH: constants.CONFIG_PATH + '/environments/',
  INITIALIZERS_PATH: constants.CONFIG_PATH + '/initializers/',
  UMBRELLA_INIT_PATH: constants.CONFIG_PATH + '/initializers/Umbrella',
  ROUTES_PATH: '/routes/',
  MIDDLEWARES_PATH: constants.CONFIG_PATH + '/middlewares/',
  UMBRELLA_ROUTES_PATH: constants.CONFIG_PATH + '/routes',
  EXPECTED_SERVER_FILENAME: 'server.js',
  MODEL_DIR: '/models/'
};

/**
 * The umbrella object with public api.
 */
module.exports = function(parentModule) {
  // Define internal injectable components exposed as read only
  // All internals must be specified here before use to ensure public api exposure
  // All internals can be reached through the umbrella object or by injecting $[internalComponent]
  var internals = {
    express: express,
    app: null,
    server: null,
    root: null,
    components: null,
    middlewares: null,
    routes: null
  };

  // Define the umbrella object
  var umbrella = {
    /**
     * Create an express app and set up umbrella.
     * Loads the umbrella initializer, router and custom middlewares.
     *
     * @param components The components to allow for injection.
     * @returns The umbrella object.
     */
    bootstrap: function(components) {
      if(this.app !== null) throw new Error('umbrella bootstrap is being called multiple times which is not allowed.');

      // Expect the server module to be called server.js and be the bootstrapping parent of umbrella,
      // this is a precaution to avoid accidental bootstrapping from a sub-module which may cause issues.
      if(path.basename(parentModule.filename) !== constants.EXPECTED_SERVER_FILENAME) {
        console.warn('umbrella is being bootstrapped from a module other than server.js,' +
          ' this may cause unexpected behavior');
      }

      // Define the express app objects in a safe manner
      var app = express();

      // Set internal components
      internals.app = app;
      internals.server = http.createServer(app);
      internals.root = path.dirname(parentModule.filename);
      internals.components = components;

      // Require the expected configuration modules
      var configEnvBase = this.root + constants.ENVIRONMENTS_PATH;
      config.all = require(configEnvBase + 'all');
      config.dev = require(configEnvBase + 'development');
      config.pro = require(configEnvBase + 'production');

      // Require the umbrella main initializer
      umbrellaInit = require(this.root + constants.UMBRELLA_INIT_PATH);

      // Require the routes config
      umbrellaRoutes = require(this.root + constants.UMBRELLA_ROUTES_PATH);

      // Create the dependency component object
      injectComponents = utilities.createInjectionComponents(internals.components, internals);

      return this;
    },

    /**
     * Build the custom middlewares dependancy object and inject component dependencies
     *
     * @returns The umbrella object.
     */
    buildMiddlewares: function() {
      if(this.app === null) throw new Error('umbrella has to be bootstrapped before buildMiddlewares() is called.');

      internals.middlewares = utilities.buildAndInject(this.root + constants.MIDDLEWARES_PATH, this, injectComponents);
      return this;
    },

    /**
     * Process each configuration for the current environment
     *
     * @returns The umbrella object.
     */
    configure: function() {
      if(this.app === null) throw new Error('umbrella has to be bootstrapped before configure() is called.');
      var self = this;

      // Run configuration for the current environment providing specified components and custom middlewares
      this.app.configure(function(){utilities.injectDependencies(config.all, self, injectComponents, true);})
        .configure('development', function(){utilities.injectDependencies(config.dev, self, injectComponents, true);})
        .configure('production', function(){utilities.injectDependencies(config.pro, self, injectComponents, true);});

      return this;
    },

    /**
     * Initialize components specified by components object using each specific initializer
     * in the order and with the dependant components specified in umbrella initializer
     * This is done asynchronously since some initializer may be run async.
     *
     * @param initCallback The callback for when initialization is done, is called according to convention with
     *                     (err,  umbrella)
     * @returns undefined, this function cannot be chained. Chain through callback.
     */
    init: function(initCallback) {
      if(this.app === null) throw new Error('umbrella has to be bootstrapped before init() is called.');
      var self = this;
      var initBase = this.root + constants.INITIALIZERS_PATH;

      // Map the initializer function invoker for each initializer descriptor
      var initializers = umbrellaInit(this.components).map(function(initDescriptor) {
        var initializer = require(initBase + initDescriptor.component);

        // Determine correct initializer for current environment
        if(self.app.settings.env === 'production') initializer = initializer.production || initializer;
        else initializer = initializer.development || initializer;

        // Initializer should now be a valid function, otherwise the initializer is incorrectly configured
        if(typeof initializer !== 'function') {
          throw new Error('umbrella encountered an incomplete initializer for ' +
            initDescriptor.component + ' component ');
        }

        // Determine if the initializer is asynchronous
        var async = utilities.determineAsync(initializer);

        // Create array of dependency argument if any
        var initArgs = Array.isArray(initDescriptor.dependencies) ?
          initDescriptor.dependencies :
          (initDescriptor.dependencies ? [initDescriptor.dependencies] : []);

        // Return a function for this initializer passing any errors to the callback
        return function(callback) {
          if(async) {
            initArgs.push(callback);
            initializer.apply(self.app, initArgs);
          } else {
            try {
              initializer.apply(self.app, initArgs);
              callback(null);
            } catch(err) {
              callback(err);
            }
          }
        };
      });

      // Now run all initializers in a sequence to guarantee order
      async.series(initializers, function(err) {
        return initCallback && initCallback(err, self);
      });

      // Do not return anything to prevent chaining for this async function
    },

    /**
     * Map routes contained in routes directory using umbrella route config.
     * Also injects dependencies for routes.
     *
     * @returns The umbrella object.
     */
    route: function() {
      if(this.app === null) throw new Error('umbrella has to be bootstrapped before route() is called.');

      // Map each route module to a routes object and inject dependencies accordingly
      internals.routes = utilities.buildAndInject(this.root + constants.ROUTES_PATH, this, injectComponents);

      // Call routes config with dependencies
      utilities.injectDependencies(umbrellaRoutes, this, injectComponents, true);

      return this;
    },

    /**
     * Bootstrap all models present in model folder.
     * @returns The umbrella object.
     */
    bootstrapModels: function() {
      if(this.app === null) throw new Error('umbrella has to be bootstrapped before bootstrapModels() is called.');

      var self = this,
        modelDirAbs = this.root + constants.MODEL_DIR;

      // Only bootstrap if model folder present
      if(utilities.folderExists(modelDirAbs)) {
        utilities.mapAllFilesSync(modelDirAbs, function(file) {
          // Inject dependencies to model for bootstrapping
          // If the model bootstrapper function has more parameters than dependencies it cannot be invoked
          utilities.injectDependencies(require(modelDirAbs + file), self, injectComponents, true);
        });
      }

      return this;
    },

    /**
     * Start to listen on default port (3000) or port specified by environment.
     * @returns The umbrella object.
     */
    listen: function() {
      if(this.app === null) throw new Error('umbrella has to be bootstrapped before listen() is called.');

      var port = process.env.PORT || 3000;
      this.server.listen(port);
      console.log('Umbrella told express to listen on port %d in %s mode', port, this.app.settings.env);

      return this;
    },

    /**
     * Combine bootstrapping and all initialization in a single function for convenience.
     * Will not throw errors, all errors are provided in callback.
     * Umbrella will silently fail if callback errors are ignored.
     *
     * @param components The components to allow for injection.
     * @param callback The callback for when initialization is done and express has started listening,
     *                 is called according to convention with (err,  umbrella)
     * @returns undefined, this function cannot be chained. Chain through callback.
     */
    all: function(components, callback) {
      try {
        // Bootstrap sync then init async
        this.bootstrap(components).buildMiddlewares().configure().init(function(err, umbrella) {
          if(err) return callback && callback(err, umbrella); // Pass on initializer errors
          try {
            // When init async is done, configure, route and listen sync then callback
            umbrella.route().bootstrapModels().listen();
            return callback && callback(null, umbrella);
          } catch (err) {
            return callback && callback(err, umbrella);
          }
        });
      } catch (err) {
        return callback && callback(err, this);
      }
    },

    /**
     * Create a initializer description object from a component initializer and optional dependencies.
     *
     * @param component The component initializer name.
     * @param [dependencies] The dependencies for the initializer, like the component itself.
     * @returns {{component: *, dependencies: *}} A descriptor object for umbrella initializer.
     */
    describeInitializer: function(component, dependencies) {
      return dependencies ? { component: component, dependencies: dependencies } : { component: component };
    }
  };

  // Expose internal components through the umbrella api
  Object.keys(internals).forEach( function(key) {
    Object.defineProperty(umbrella, key, {
      // Read only getter to support for later internal changes
      get: function() { return internals[key]; },
      enumerable: true,
      configurable: false
    });
  });

  return umbrella;
};