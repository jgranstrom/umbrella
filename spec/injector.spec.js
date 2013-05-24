'use strict';
/* Define test-specific jshint options */
/* jshint unused:false */ // unused ignore because of should usage
/* jshint expr:true */ // expressions ignored because of should-expressions
/* global describe: true */
/* global it: true */

/**
 * Require modules.
 */
var injector = require('../lib/injector'),
  should = require('should');

/**
 * Test the dependency injection system
 */
describe('dependency injection', function() {
  var contextObject = {};
  var depObject = {dep1: 'dep1', dep2: 'dep2'};
  var injectNoDependencies = injector.create(contextObject, {});
  var injectDependencies = injector.create(contextObject, depObject);

  it('should inject nothing and have the right context and return result directly', function() {
    var dep = function() { return this; };
    injectNoDependencies(dep).should.equal(contextObject);
  });

  it('should inject all dependencies', function() {
    var dep = function(dep1, dep2) {return {context: this, dep1: dep1, dep2: dep2};};
    var returned = injectDependencies(dep);
    returned.context.should.equal(contextObject);
    returned.dep1.should.equal(depObject.dep1);
    returned.dep2.should.equal(depObject.dep2);
  });

  it('should inject one dependency', function() {
    var dep = function(dep1) {return {context: this, dep1: dep1, args: arguments};};
    var returned = injectDependencies(dep);
    returned.context.should.equal(contextObject);
    returned.dep1.should.equal(depObject.dep1);
    returned.args.length.should.equal(1);
  });

  it('should inject nothing and return a function with all parameters', function() {
    var dep = function(param1, param2) {return {context: this, param1: param1, param2: param2};};
    var returned = injectDependencies(dep);
    (typeof returned).should.equal('function');
    var returnedObj = returned('a', 'b');
    returnedObj.context.should.equal(contextObject);
    returnedObj.param1.should.equal('a');
    returnedObj.param2.should.equal('b');
  });

  it('should inject all dependencies and return a function of additional parameters', function() {
    var dep = function(dep1, dep2, param1, param2) {return {context: this,  dep1: dep1, dep2: dep2,
      param1: param1, param2: param2};};
    var returned = injectDependencies(dep);
    (typeof returned).should.equal('function');
    var returnedObj = returned('a', 'b');
    returnedObj.context.should.equal(contextObject);
    returnedObj.dep1.should.equal(depObject.dep1);
    returnedObj.dep2.should.equal(depObject.dep2);
    returnedObj.param1.should.equal('a');
    returnedObj.param2.should.equal('b');
  });
});