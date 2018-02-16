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
    code.expect(logObj.data.message).to.include('request took');
    code.expect(typeof logObj.data.responseTime).to.equal('number');
    code.expect(typeof logObj.data.id).to.not.equal(undefined);
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
  code.expect(statements[0].message).to.include('request took');
  code.expect(typeof statements[0].responseTime).to.equal('number');
});

lab.test('individual routes can override threshold', { timeout: 5000 }, async () => {
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
  code.expect(statements[0].message).to.include('request took');
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
  code.expect(statements[1].data.timings['call db'].elapsed).to.be.greaterThan(199);
});
