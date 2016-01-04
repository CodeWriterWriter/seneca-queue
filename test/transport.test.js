
var Queue = require('..')
var Seneca = require('seneca')
var expect = require('code').expect
var Async = require('async')

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach

describe('seneca queue', function () {
  describe('Through transport', function () {
    var client
    var server1
    var server2

    beforeEach(function startServer1 (done) {
      server1 = Seneca({ log: 'silent' })
        .use(Queue)
        .listen(8081)
        .ready(done)
    })

    beforeEach(function startServer2 (done) {
      server2 = Seneca({ log: 'silent' })
        .use(Queue)
        .listen(8082)
        .ready(done)
    })

    beforeEach(function startClient (done) {
      client = Seneca({ log: 'silent' })
        .client({ port: 8081, pin: 'cmd:enqueue-remote,queue:queue1' })
        .client({ port: 8082, pin: 'cmd:enqueue-remote,queue:queue2' })
        .use(Queue, {
          queues: [
            'queue1',
            'queue2'
          ]
        })
        .ready(done)
    })

    afterEach(function (done) {
      Async.each([server1, server2, client], function (server, cb) {
        server.close(cb)
      }, done)
    })

    it('should process a task on the first worker', function (done) {
      var task = {
        task: 'my task',
        param: 42
      }

      server1.add({
        task: 'my task'
      }, function (args, cb) {
        expect(args).to.include(task)
        cb()
        done()
      })

      server2.add({
        task: 'my task'
      }, function (args, cb) {
        cb()
        done(new Error('this should never be called'))
      })

      server1.act({ role: 'queue', cmd: 'start' })
      server2.act({ role: 'queue', cmd: 'start' })

      client.act({ role: 'queue', cmd: 'enqueue', msg: task }, function (err) {
        if (err) { return done(err) }
      })
    })

    it('should process a task on both workers', function (done) {
      var task1 = {
        task: 'my task',
        param: 1
      }
      var task2 = {
        task: 'my task',
        param: 2
      }
      var count = 2

      server1.add({
        task: 'my task'
      }, function (args, cb) {
        expect(args).to.include(task1)
        cb()
        if (--count === 0) {
          done()
        }
      })

      server2.add({
        task: 'my task'
      }, function (args, cb) {
        expect(args).to.include(task2)
        cb()
        if (--count === 0) {
          done()
        }
      })

      server1.act({ role: 'queue', cmd: 'start' })
      server2.act({ role: 'queue', cmd: 'start' })

      client.act({ role: 'queue', cmd: 'enqueue', msg: task1 }, function (err) {
        if (err) { return done(err) }
      })
      client.act({ role: 'queue', cmd: 'enqueue', msg: task2 }, function (err) {
        if (err) { return done(err) }
      })
    })
  })
})
