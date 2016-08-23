'use strict';
const Hapi = require('hapi');
const code = require('code');
const lab = exports.lab = require('lab').script();
const hapiSlow = require('../index.js');

let server;
lab.beforeEach((done) => {
  server = new Hapi.Server({});
  server.connection();
  done();
});

lab.afterEach((done) => {
  server.stop(() => {
    done();
  });
});

lab.test('will log delayed requests', { timeout: 5000 }, (done) => {
  server.register({
    register: hapiSlow,
    options: {
      threshold: 10,
      logr: {
        defaultTags: ['warning']
      }
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
        }, 1200);
      }
    });
    const logged = [];
    const oldLog = console.log;
    console.log = (statement) => {
      oldLog(statement)
      logged.push(statement);
    }
    setTimeout(() => {
      console.log = oldLog;
      code.expect(logged.length).to.be.greaterThan(0);
      code.expect(logged[0]).to.include('lagging');
      done();
    }, 4000);
    server.inject({
      url: '/'
    }, (response) => {
      code.expect(response.statusCode).to.equal(200);
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
    const oldLog = console.log;
    // will fail if anything is logged:
    console.log = (statement) => {
      expect(false).to.equal(true);
    }
    server.inject({
      url: '/'
    }, (response) => {
      code.expect(response.statusCode).to.equal(200);
      setTimeout(() => {
        console.log = oldLog;
        done();
      }, 1100);
    });
  });
});
