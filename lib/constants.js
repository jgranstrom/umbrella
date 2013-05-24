'use strict';
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
Object.freeze(constants);

module.exports = constants;