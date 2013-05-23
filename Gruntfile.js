'use strict';
/* jshint camelcase:false */

module.exports = function(grunt) {
	// Configuration
	grunt.initConfig({
		jshint: {
			all: {
				options: {
          camelcase: true,
          eqeqeq: true,
          forin: true,
          immed: true,
          latedef: true,
          newcap: true,
          noarg: true,
          quotmark: 'single',
          undef: true,
          unused: true,
					node: true,
					es5: true,
					strict: true
				},
				files: {
					src: ['*.js', 'lib/**/*.js', 'spec/**/*.js']
				}				
			}
		},

    'jasmine-node': {
      run: {
        spec: 'spec'
      }
    }
	});

	// Load plugins
	grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-jasmine-node');

	// Register tasks
	grunt.registerTask('default', ['jshint', 'jasmine-node']);
};