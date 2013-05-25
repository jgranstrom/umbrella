'use strict';
/**
 * Required modules.
 */
var utilities = require('./utilities'),
  injector = require('./injector'),
  initializer = require('./initializer'),
  builder = require('./builder'),
  constants = require('./constants'),
  configurator = require('./configurator'),
  express = require('express'),
  http = require('http'),
  path = require('path');

/**
 * The umbrella object with public api.
 */
module.exports = function(parentModule) {
  // Define internal injectable components exposed as read only
  // All internals must be specified here before use to ensure public api exposure
  // All internals can be reached through the umbrella object or by injecting $[internalComponent]
  var internals = {
    umbrella: null,
    express: express,
    app: null,
    server: null,
    root: null,
    components: null,
    middlewares: null,
    routes: null,
    describe: utilities.describeInitializer
  };

  // Inject may be exposed through internals if required later on
  var inject = null; // The inject function will be created with the injector on bootstrap

  // Define the umbrella object
  var umbrella = {
    /**
     * Create an express app and set up umbrella.
     * Loads the umbrella initializer, router and components and sets up the internals.
     *
     * @param components The components to allow for injection.
     * @returns The umbrella object.
     */
    bootstrap: function(components) {
      if(internals.app !== null) throw new Error('umbrella bootstrap is being called multiple times which is not allowed.');

      // Expect the server module to be called server.js and be the bootstrapping parent of umbrella,
      // this is a precaution to avoid accidental bootstrapping from a sub-module which may cause issues.
      if(path.basename(parentModule.filename) !== constants.EXPECTED_SERVER_FILENAME) {
        console.warn('umbrella is being bootstrapped from a module other than server.js,' +
          ' this may cause unexpected behavior');
      }

      // Set internal components
      internals.umbrella = this;
      internals.app = express();
      internals.server = http.createServer(internals.app);
      internals.root = path.dirname(parentModule.filename);
      internals.components = components;

      // Create an injector function for this umbrella object with the app as context and injection components
      inject = injector.create(internals.app, utilities.createInjectionComponents(internals.components, internals));

      return this;
    },

    /**
     * Build the custom middlewares dependancy object and inject component dependencies
     *
     * @returns The umbrella object.
     */
    buildMiddlewares: function() {
      if(internals.app === null) throw new Error('umbrella has to be bootstrapped before buildMiddlewares() is called.');

      // Bulid dependancy object and inject with injector
      internals.middlewares = builder.buildAndProcess(internals.root + constants.MIDDLEWARES_PATH, inject);
      return this;
    },

    /**
     * Process each configuration for the current environment
     *
     * @returns The umbrella object.
     */
    configure: function() {
      if(internals.app === null) throw new Error('umbrella has to be bootstrapped before configure() is called.');

      // Require the umbrella environment modules
      var environmentsPath = internals.root + constants.ENVIRONMENTS_PATH;
      var config = {
        all: require(environmentsPath + 'all'),
        development: require(environmentsPath + 'development'),
        production: require(environmentsPath + 'production')
      };

      // Run the configurations
      configurator(internals.app, config, inject);

      return this;
    },

    /**
     * Initialize components specified by components object using each specific initializer
     * in the order specified in Umbrella initializer.
     * This is done asynchronously since some initializer may be run async.
     *
     * @param initCallback The callback for when initialization is done, is called according to convention with
     *                     (err,  umbrella)
     * @returns undefined, this function cannot be chained. Chain through callback.
     */
    init: function(initCallback) {
      if(internals.app === null) throw new Error('umbrella has to be bootstrapped before init() is called.');

      // Run the initializers
      initializer(internals.app.settings.env,
        require(internals.root + constants.UMBRELLA_INIT_PATH),
        internals.root + constants.INITIALIZERS_PATH,
        inject,
        function(err) {
          initCallback(err, internals.umbrella);
        }
      );

      // Do not return anything to prevent chaining for this async function
    },

    /**
     * Bootstrap all models present in model folder.
     * @returns The umbrella object.
     */
    bootstrapModels: function() {
      if(internals.app === null) throw new Error('umbrella has to be bootstrapped before bootstrapModels() is called.');

      var modelDirAbs = internals.root + constants.MODEL_DIR;

      // Only bootstrap if model folder present
      if(utilities.folderExists(modelDirAbs)) {
        utilities.mapAllFilesSync(modelDirAbs, function(file) {
          // Inject dependencies to model for bootstrapping
          // If the model bootstrapper function has more parameters than dependencies it cannot be invoked
          inject(require(modelDirAbs + file), true);
        });
      }

      return this;
    },

    /**
     * Map routes contained in routes directory using umbrella route config.
     * Also injects dependencies for routes.
     *
     * @returns The umbrella object.
     */
    route: function() {
      if(internals.app === null) throw new Error('umbrella has to be bootstrapped before route() is called.');

      // Map each route module to a routes object and inject dependencies accordingly
      internals.routes = builder.buildAndProcess(internals.root + constants.ROUTES_PATH, inject);

      // Call routes config with dependencies
      inject(require(internals.root + constants.UMBRELLA_ROUTES_PATH), true);

      return this;
    },

    /**
     * Start to listen on default port (3000) or port specified by environment.
     * @returns The umbrella object.
     */
    listen: function() {
      if(internals.app === null) throw new Error('umbrella has to be bootstrapped before listen() is called.');

      var port = process.env.PORT || 3000;
      internals.server.listen(port);
      console.log('Umbrella told express to listen on port %d in %s mode', port, internals.app.settings.env);

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
            umbrella.bootstrapModels().route().listen();
            return callback && callback(null, umbrella);
          } catch (err) {
            return callback && callback(err, umbrella);
          }
        });
      } catch (err) {
        return callback && callback(err, this);
      }
    }
  };

  // Expose internal components through the umbrella api in a confined internals object
  // User may acquire internal components freely through this object. Don't put them directly
  // on the umbrella object to avoid clobbering.
  utilities.exposeInternals(umbrella, internals);

  return umbrella;
};