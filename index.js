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
  const requestTimeoutExpired = (responseTime, threshold, request) => {
    // log the tardiness:
    server.log(tags, {
      id: request.id,
      responseTime,
      threshold,
      message: `request took ${responseTime}ms to process`,
      url: request.url.path,
      hash: request.url.hash,
      method: request.method,
      userAgent: request.headers['user-agent'],
      referrer: request.info.referrer
    });
    if (request.plugins['hapi-slow']) {
      Object.keys(request.plugins['hapi-slow']).forEach((key) => {
        server.log(['hapi-slow', 'timing data'], request.plugins['hapi-slow'][key]);
      });
    }
  };
  server.decorate('request', 'timingStart', function(key) {
    if (!this.plugins['hapi-slow']) {
      this.plugins['hapi-slow'] = {};
    }
    this.plugins['hapi-slow'][key] = { name: key, start: new Date() };
  });
  server.decorate('request', 'timingEnd', function(key) {
    const timing = this.plugins['hapi-slow'][key];
    timing.end = new Date();
    timing.elapsed = timing.end - timing.start;
  });

  server.on('tail', (request) => {
    // check the tail response times and notify if needed:
    const responseTime = request.info.responded - request.info.received;
    const plugin = request.route.settings.plugins['hapi-slow'];
    const threshold = (plugin && plugin.threshold) ? plugin.threshold : options.threshold;
    if (responseTime > threshold) {
      requestTimeoutExpired(responseTime, threshold, request);
    }
  });

  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
