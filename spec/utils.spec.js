'use strict';
/* Define test-specific jshint options */
/* jshint unused:false */ // unused ignore because of should usage
/* jshint expr:true */ // expressions ignored because of should-expressions
/* global describe: true */
/* global it: true */

/**
 * Require modules.
 */
var utilities = require('../lib/util'),
  should = require('should');

/**
 * Test the object proxy
 */
describe('object proxy', function() {
  it('should be in obj context', function() {
    var obj = { text: 'in object' };
    var func = function() {
      this.text.should.equal(obj.text);
    };
    var proxyFunc = utilities.objectProxy(obj, func);
    (typeof proxyFunc).should.equal('function');
    proxyFunc();
  });
});

/**
 * Test the parameter extractor
 */
describe('function parameter extraction', function() {
  it('should return an empty array', function() {
    var arr = utilities.getFunctionParameters(function(){});
    Array.isArray(arr).should.be.true;
    arr.length.should.equal(0);
  });

  it('should return parameters in order', function() {
    var arr = utilities.getFunctionParameters(function(a, b, c, d, e){});
    Array.isArray(arr).should.be.true;
    arr.length.should.equal(5);
    arr[0].should.equal('a');
    arr[1].should.equal('b');
    arr[2].should.equal('c');
    arr[3].should.equal('d');
    arr[4].should.equal('e');
  });
});

/**
 * Test the asynchronous function detector
 */
describe('detecting async functions', function() {
  var isAsync = function(a, b, c, done) {},
    isAsyncOnly = function(done) {},
    isNotAsync = function(a, b) {},
    isNotAsyncOnly = function() {},
    isNotAsyncWarn = function(a, done, b) {};

  it('should detect as async', function() {
     utilities.determineAsync(isAsync).should.be.true;
  });

  it('should detect as async', function() {
    utilities.determineAsync(isAsyncOnly).should.be.true;
  });

  it('should detect as not async', function() {
    utilities.determineAsync(isNotAsync).should.be.false;
  });

  it('should detect as not async', function() {
    utilities.determineAsync(isNotAsyncOnly).should.be.false;
  });

  it('should detect as not async and warn user', function() {
    console.log('warning output is expected.');
    utilities.determineAsync(isNotAsyncWarn).should.be.false;
  });
});
