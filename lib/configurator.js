'use strict';
/**
 * Configure an express application with specified environment config path and inject function
 * @param app The express app to configure.
 * @param config The configuration modules for each environment
 * @param inject The inject function for dependencies.
 */
module.exports = function(app, config, inject) {
  // Require and run configuration for the current environment with injected dependencies
  app.configure(inject.bind(app, config.all, true))
    .configure('development',inject.bind(app, config.development, true))
    .configure('production', inject.bind(app, config.production, true));
};