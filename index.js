'use strict';
const _ = require('lodash');

const defaultOptions = {
  // time in ms, longer than this will trigger a warning:
  threshold: 1000,
  // will be included, plus whatever additional tags they want to add:
  tags: ['hapi-slow']
};

exports.register = (server, config, next) => {
  const tags = _.union(config.tags, defaultOptions.tags);
  const options = _.defaults(config, defaultOptions);
  const tails = {};

  // when a request took too long, do this:
  const requestTimeoutExpired = (request) => {
    // log the tardiness:
    server.log(tags, {
      id: request.id,
      threshold: options.threshold,
      message: `request took too long to process`,
      url: request.url,
      userAgent: request.userAgent
    });
  };

  const onRequestHandler = (request, reply) => {
    // set the tail method for this request:
    tails[request.id] = request.addTail(request.id);
    return reply.continue();
  };

  const onResponse = (request, reply) => {
    // call the tail method for this request:
    tails[request.id]();
    return reply.continue();
  }
  server.on('tail', (request) => {
    // check the tail response times and notify if needed:
    if (request.info.responded - request.info.received > options.threshold) {
      requestTimeoutExpired(request);
    }
    tails[request.id] = undefined;
  });

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
