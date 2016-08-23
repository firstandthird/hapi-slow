'use strict';
const Logr = require('logr');
const _ = require('lodash');
const defaultOptions = {
  // time in ms, longer than this will trigger a warning:
  threshold: 1000,
  // you can pass optiosn to customize how logr notifies you of a slow response:
  logr: {
  }
};

// request timeouts are indexed by request.id:
const outstandingTimeouts = {};

exports.register = (server, config, next) => {
  const options = _.defaults(config, defaultOptions);
  const log = new Logr(options.logr);

  // when a request's timeout expires, do this:
  const requestTimeoutExpired = (request) => {
    // log the tardiness:
    log(['warning', 'hapi-slow'], `Request ${request.id} lagging more than ${options.threshold} seconds`);
    // remove the timeout:
    outstandingTimeouts[request.id] = undefined;
  };

  const onRequestHandler = (request, reply) => {
    outstandingTimeouts[request.id] = setTimeout( () => {
      requestTimeoutExpired(request);
    }, options.threshold);
    return reply.continue();
  };

  const onResponse = (request, reply) => {
    // // clear and remove any timeouts for this request:
    if (outstandingTimeouts[request.id] === undefined) {
      return;
    }
    clearTimeout(outstandingTimeouts[request.id]);
    outstandingTimeouts[request.id] = undefined;
    return reply.continue();
  };

  server.ext({
    type: 'onRequest',
    method: onRequestHandler
  });
  server.ext({
    type: 'onPreResponse',
    method: onResponse
  });
  next();
};

exports.register.attributes = {
  name: 'hapi-slow',
  version: '0.1.0'
};
