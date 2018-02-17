const _ = require('lodash');

const defaults = {
  // in this mode we will log each step of
  // the hapi request lifecycle (https://hapijs.com/api#request-lifecycle)
  requestLifecycle: false,
  // time in ms, longer than this will trigger a warning:
  threshold: 1000,
  // will be included, plus whatever additional tags they want to add:
  tags: ['hapi-timing']
};

const register = function(server, options) {
  const tags = _.union(options.tags, defaults.tags);
  options = Object.assign({}, defaults, options);

  // when a request took too long, do this:
  const requestTimeoutExpired = (responseTime, threshold, request) => {
    // log the tardiness:
    server.log(tags, {
      id: request.info.id,
      responseTime,
      threshold,
      message: `request took ${responseTime}ms to process`,
      url: request.url.path,
      hash: request.url.hash,
      method: request.method,
      userAgent: request.headers['user-agent'],
      referrer: request.info.referrer,
      timings: request.plugins['hapi-timing']
    });
  };

  server.decorate('request', 'timingStart', function(key) {
    if (!this.plugins['hapi-timing']) {
      this.plugins['hapi-timing'] = {};
    }
    this.plugins['hapi-timing'][key] = { name: key, start: new Date() };
  });

  server.decorate('request', 'timingEnd', function(key) {
    const timing = this.plugins['hapi-timing'][key];
    timing.end = new Date();
    timing.elapsed = timing.end - timing.start;
  });

  if (options.requestLifecycle) {
    const eventNames = ['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler'];
    eventNames.forEach(eventName => {
      server.ext(eventName, (request, h) => {
        if (!request.plugins['hapi-timing']) {
          request.plugins['hapi-timing'] = {};
        }
        request.plugins['hapi-timing'][eventName] = new Date();
        return h.continue;
      });
    });
    server.events.on('response', (request) => {
      request.plugins['hapi-timing'].timings = {};
      eventNames.forEach((eventName, i) => {
        if (i === 0) {
          const nextEventName = eventNames[i + 1];
          request.plugins['hapi-timing'].timings[eventName] = request.plugins['hapi-timing'][nextEventName].getTime() -
            request.plugins['hapi-timing'][eventName].getTime();
        } else {
          const previousEventName = eventNames[i - 1];
          request.plugins['hapi-timing'].timings[eventName] = request.plugins['hapi-timing'][eventName].getTime() -
            request.plugins['hapi-timing'][previousEventName].getTime();
        }
      });
      // log the tardiness:
      const responseTime = request.info.responded - request.info.received;
      server.log(tags, {
        id: request.info.id,
        responseTime,
        message: `request took ${responseTime}ms to process`,
        url: request.url.path,
        hash: request.url.hash,
        method: request.method,
        userAgent: request.headers['user-agent'],
        referrer: request.info.referrer,
        timings: request.plugins['hapi-timing'].timings
      });
    });
  } else {
    server.events.on('response', (request) => {
      // check the tail response times and notify if needed:
      const responseTime = request.info.responded - request.info.received;
      const plugin = request.route.settings.plugins['hapi-timing'];
      const threshold = (plugin && plugin.threshold) ? plugin.threshold : options.threshold;
      if (responseTime > threshold) {
        requestTimeoutExpired(responseTime, threshold, request);
      }
    });
  }
};

exports.plugin = {
  name: 'hapi-timing',
  register,
  once: true,
  pkg: require('./package.json')
};
