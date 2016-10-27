'use strict';

const Hapi = require('hapi');
const code = require('code');
const lab = exports.lab = require('lab').script();
const hapiSlow = require('../index.js');
const Logr = require('logr');

let server;
lab.beforeEach((done) => {
  server = new Hapi.Server({
    debug: {
      log: ['hapi-slow']
    }
  });
  server.connection();
  done();
});

lab.afterEach((done) => {
  server.stop(() => {
    done();
  });
});

lab.test('will log delayed requests', { timeout: 5000 }, (done) => {
  const statements = [];
  server.on('log', (logObj) => {
    code.expect(logObj.tags).to.include('hapi-slow');
    code.expect(logObj.tags).to.include('error');
    code.expect(typeof logObj.data).to.equal('object');
    code.expect(logObj.data.message).to.include('request took');
    code.expect(typeof logObj.data.expired).to.equal('number');
    code.expect(typeof logObj.data.id).to.not.equal(undefined);
    statements.push(logObj.data);
  })
  server.register({
    register: hapiSlow,
    options: {
      threshold: 10,
      tags: ['error']
    }
  }, (err) => {
    if (err) {
      throw err;
    }
    server.route({
      method: 'GET',
      path: '/',
      handler: (request, reply) => {
        setTimeout(() => {
          reply('done!');
        }, 200);
      }
    });
    setTimeout(() => {
      done();
    }, 4000);
    server.inject({
      url: '/'
    }, (response) => {
      code.expect(response.statusCode).to.equal(200);
      code.expect(statements.length).to.equal(1);
      code.expect(statements[0].message).to.include('request took');
      code.expect(typeof statements[0].expired).to.equal('number');
    });
  });
});

lab.test('will not react to requests that do not exceed the threshold', { timeout: 5000 }, (done) => {
  server.register({
    register: hapiSlow,
    options: {
      threshold: 1000
    }
  }, (err) => {
    if (err) {
      throw err;
    }
    server.route({
      method: 'GET',
      path: '/',
      handler: (request, reply) => {
        reply('done!');
      }
    });
    // will fail if anything is logged:
    server.on('log', () => {
      code.expect(false).to.equal(true);
    });
    server.inject({
      url: '/'
    }, (response) => {
      code.expect(response.statusCode).to.equal(200);
      setTimeout(() => {
        done();
      }, 1100);
    });
  });
});
