const Hapi = require('hapi');
const code = require('code');
const lab = exports.lab = require('lab').script();
const hapiTiming = require('../index.js');

let server;
lab.beforeEach((done) => {
  server = new Hapi.Server({
    debug: {
      log: ['hapi-timing']
    },
    host: 'localhost',
    port: 8000
  });
});

lab.afterEach(async (done) => {
  await server.stop();
});

lab.test('will log delayed requests', { timeout: 5000 }, async () => {
  const statements = [];

  server.events.on('log', (logObj) => {
    code.expect(logObj.tags).to.include('hapi-timing');
    code.expect(logObj.tags).to.include('error');
    code.expect(typeof logObj.data).to.equal('object');
    code.expect(typeof logObj.data.responseTime).to.equal('number');
    statements.push(logObj.data);
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10,
      tags: ['error']
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'done!';
    }
  });

  const response = await server.inject({
    url: '/'
  });

  code.expect(response.statusCode).to.equal(200);
  code.expect(statements.length).to.equal(1);
  code.expect(typeof statements[0].responseTime).to.equal('number');
});

lab.test('will include id and referrer if specified', { timeout: 5000 }, async () => {
  const statements = [];

  server.events.on('log', (logObj) => {
    code.expect(logObj.tags).to.include('hapi-timing');
    code.expect(logObj.tags).to.include('error');
    code.expect(typeof logObj.data).to.equal('object');
    code.expect(typeof logObj.data.responseTime).to.equal('number');
    code.expect(typeof logObj.data.id).to.equal('string');
    statements.push(logObj.data);
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10,
      includeId: true,
      tags: ['error']
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'done!';
    }
  });

  const response = await server.inject({
    url: '/',
    headers: {
      referrer: 'a mysterious carnival barker'
    }
  });

  code.expect(response.statusCode).to.equal(200);
  code.expect(statements.length).to.equal(1);
  code.expect(typeof statements[0].responseTime).to.equal('number');
  code.expect(statements[0].referrer).to.equal('a mysterious carnival barker');
});

lab.test('individual routes can override threshold', { timeout: 5000 }, async () => {
  const statements = [];

  server.events.on('log', (logObj) => {
    code.expect(logObj.tags).to.include('hapi-timing');
    code.expect(logObj.tags).to.include('error');
    code.expect(typeof logObj.data).to.equal('object');
    code.expect(typeof logObj.data.responseTime).to.equal('number');
    statements.push(logObj.data);
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10000000,
      tags: ['error']
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    config: {
      plugins: {
        'hapi-timing': {
          threshold: 10
        }
      }
    },
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'done!';
    }
  });

  const response = await server.inject({
    url: '/'
  });

  code.expect(response.statusCode).to.equal(200);
  code.expect(statements.length).to.equal(1);
  code.expect(typeof statements[0].responseTime).to.equal('number');
});

lab.test('individual routes can disable hapi-timing by setting threshold to false', { timeout: 5000 }, async () => {
  const statements = [];

  server.events.on('log', (logObj) => {
    code.expect(logObj.tags).to.include('hapi-timing');
    code.expect(logObj.tags).to.include('error');
    code.expect(typeof logObj.data).to.equal('object');
    code.expect(logObj.data.message).to.include('request took');
    code.expect(typeof logObj.data.responseTime).to.equal('number');
    code.expect(typeof logObj.data.id).to.not.equal(undefined);
    statements.push(logObj.data);
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10000000,
      tags: ['error']
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    config: {
      plugins: {
        'hapi-timing': {
          threshold: false
        }
      }
    },
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'done';
    }
  });

  const response = await server.inject({
    url: '/'
  });

  code.expect(response.statusCode).to.equal(200);
  code.expect(statements.length).to.equal(0);
});

lab.test('will not react to requests that do not exceed the threshold', { timeout: 5000 }, async () => {
  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 1000
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    handler(request, h) {
      return 'done!';
    }
  });

  // will fail if anything is logged:
  server.events.on('log', () => {
    code.expect(false).to.equal(true);
  });

  const response = await server.inject({
    url: '/'
  });

  code.expect(response.statusCode).to.equal(200);
});

lab.test('verbose mode will react to all requests', { timeout: 5000 }, async () => {
  await server.register({
    plugin: hapiTiming,
    options: {
      verbose: true,
      threshold: 1000
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    handler(request, h) {
      return 'done!';
    }
  });
  const statements = [];

  server.events.on('log', (logObj) => {
    statements.push(logObj);
  });

  await server.inject({ url: '/' });
  await new Promise(resolve => setTimeout(resolve, 500));
  code.expect(statements.length).to.equal(1);
});

lab.test('it tracks which method was used', async () => {
  server.events.on('log', (logObj) => {
    code.expect(logObj.data.method).to.equal('get');
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10,
      tags: ['error']
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'done';
    }
  });

  await server.inject({
    url: '/'
  });
});

lab.test('adds timingStart and timingEnd request methods', { timeout: 5000 }, async () => {
  const statements = [];

  server.events.on('log', (logObj) => {
    statements.push(logObj);
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10,
      tags: ['error']
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    async handler(request, h) {
      // timing entries are local to each individual request:
      code.expect(Object.keys(request.plugins).length).to.equal(0);
      request.timingStart('call db');
      request.timingStart('process data');

      await new Promise(resolve => setTimeout(resolve, 200));
      request.timingEnd('call db');

      await new Promise(resolve => setTimeout(resolve, 300));
      request.timingEnd('process data');

      return request.plugins;
    }
  });

  await server.inject({
    url: '/'
  });

  await server.inject({
    url: '/'
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  code.expect(statements.length).to.equal(2);
  code.expect(statements[1].data.timings['call db'].name).to.equal('call db');
  code.expect(statements[1].data.timings['call db'].elapsed).to.be.greaterThan(198);
});

lab.test('requestLifecycle will log timing for each step of the hapi request lifecycle', { timeout: 5000 }, async () => {
  const statements = [];

  server.events.on('log', (logObj) => {
    statements.push(logObj.data);
  });

  await server.register({
    plugin: hapiTiming,
    options: {
      threshold: 10,
      requestLifecycle: true
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { result: true };
    }
  });

  await server.inject({
    url: '/'
  });
  await new Promise(resolve => setTimeout(resolve, 200));
  const eventList = ['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler'];
  code.expect(Object.keys(statements[0].timings)).to.equal(eventList);
  eventList.forEach(eventName => {
    const obj = statements[0].timings[eventName];
    code.expect(typeof obj.elapsed).to.equal('number');
  });
  code.expect(statements[0].timings.onPreHandler.elapsed).to.be.greaterThan(198);
});
