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

  // when a request took too long, do this:
  const requestTimeoutExpired = (responseTime, request) => {
    // log the tardiness:
    server.log(tags, {
      id: request.id,
      responseTime,
      threshold: options.threshold,
      message: `request took ${responseTime}ms to process`,
      url: request.url,
      userAgent: request.userAgent
    });
  };

  server.on('tail', (request) => {
    // check the tail response times and notify if needed:
    const responseTime = request.info.responded - request.info.received;
    if (responseTime > options.threshold) {
      requestTimeoutExpired(responseTime, request);
    }
  });

  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
