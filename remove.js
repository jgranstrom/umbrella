'use strict';
var umbrella = require('./index');

var components = {
  stuff: 'hello'
};

umbrella.all(components, function(err) {
  throw err;
});
