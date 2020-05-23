const should = require('should');
const flow = require('flow');
const Master = require('../lib/master/masterAgent');
const Monitor = require('../lib/monitor/monitorAgent');
const ConsoleService = require('../lib/consoleService');

const WAIT_TIME = 200;

const masterHost = '127.0.0.1';
const masterPort = 3333;

describe('agent', function () {

    let authServer = function (msg, env, cb) {
        cb('ok');
    };

    let masterConsole = {
        authServer: authServer
    };

    it('should forward the message from master to the right monitor and get the response by reuqest', function (done) {
        let monitorId1 = 'connector-server-1';
        let monitorId2 = 'area-server-1';
        let monitorType1 = 'connector';
        let monitorType2 = 'area';
        let moduleId1 = 'testModuleId1';
        let moduleId2 = 'testModuleId2';
        let msg1 = {msg: 'message to monitor1'};
        let msg2 = {msg: 'message to monitor2'};

        let req1Count = 0;
        let req2Count = 0;
        let resp1Count = 0;
        let resp2Count = 0;

        let monitorConsole1 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req1Count++;
                moduleId.should.eql(moduleId1);
                cb(null, msg);
            }
        };

        let monitorConsole2 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req2Count++;
                moduleId.should.eql(moduleId2);
                cb(null, msg);
            }
        };

        let master = new Master(masterConsole);
        let monitor1 = new Monitor({
            consoleService: monitorConsole1,
            id: monitorId1,
            type: monitorType1,
            info: {
                host: '127.0.0.1'
            }
        });
        let monitor2 = new Monitor({
            consoleService: monitorConsole2,
            id: monitorId2,
            type: monitorType2,
            info: {
                host: '127.0.0.1'
            }
        });

        master.listen(masterPort);
        flow.exec(function () {
                monitor1.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                monitor2.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                master.request(monitorId1, moduleId1, msg1, function (err, resp) {
                    resp1Count++;
                    should.not.exist(err);
                    should.exist(resp);
                    resp.should.eql(msg1);
                });

                master.request(monitorId2, moduleId2, msg2, function (err, resp) {
                    resp2Count++;
                    should.not.exist(err);
                    should.exist(resp);
                    resp.should.eql(msg2);
                });
            });

        setTimeout(function () {
            req1Count.should.equal(1);
            req2Count.should.equal(1);
            resp1Count.should.equal(1);
            resp2Count.should.equal(1);
            monitor1.close();
            monitor2.close();
            master.close();
            done();
        }, WAIT_TIME);
    });

    it('should return error to master if monitor cb with a error by reuqest', function (done) {
        let monitorId = 'connector-server-1';
        let monitorType = 'connector';
        let moduleId = 'testModuleId';
        let msg = {msg: 'message to monitor'};
        let errMsg = 'some error message from monitor';

        let reqCount = 0;
        let respCount = 0;

        let monitorConsole = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                reqCount++;
                moduleId.should.eql(moduleId);
                cb(new Error(errMsg));
            }
        };

        let master = new Master(masterConsole);
        let monitor = new Monitor({
            consoleService: monitorConsole,
            id: monitorId,
            type: monitorType,
            info: {
                host: '127.0.0.1'
            }
        });

        master.listen(masterPort);

        flow.exec(function () {
                monitor.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                master.request(monitorId, moduleId, msg, function (err, resp) {
                    respCount++;
                    should.exist(err);
                    err.message.should.eql(errMsg);
                    should.not.exist(resp);
                });
            });

        setTimeout(function () {
            reqCount.should.equal(1);
            respCount.should.equal(1);
            monitor.close();
            master.close();
            done();
        }, WAIT_TIME);
    });

    it('should forward the message from master to the right monitor by notifyById', function (done) {
        let monitorId1 = 'connector-server-1';
        let monitorId2 = 'area-server-1';
        let monitorType1 = 'connector';
        let monitorType2 = 'area';
        let moduleId1 = 'testModuleId1';
        let moduleId2 = 'testModuleId2';
        let msg1 = {msg: 'message to monitor1'};
        let msg2 = {msg: 'message to monitor2'};

        let req1Count = 0;
        let req2Count = 0;

        let monitorConsole1 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req1Count++;
                moduleId.should.eql(moduleId1);
                msg.should.eql(msg1);
            }
        };

        let monitorConsole2 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req2Count++;
                moduleId.should.eql(moduleId2);
                msg.should.eql(msg2);
            }
        };

        let master = new Master(masterConsole);
        let monitor1 = new Monitor({
            consoleService: monitorConsole1,
            id: monitorId1,
            type: monitorType1,
            info: {host: '127.0.0.1'}
        });
        let monitor2 = new Monitor({
            consoleService: monitorConsole2,
            id: monitorId2,
            type: monitorType2,
            info: {host: '127.0.0.1'}
        });

        master.listen(masterPort);

        flow.exec(function () {
                monitor1.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                monitor2.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                master.notifyById(monitorId1, moduleId1, msg1);
                master.notifyById(monitorId2, moduleId2, msg2);
            });

        setTimeout(function () {
            req1Count.should.equal(1);
            req2Count.should.equal(1);

            monitor1.close();
            monitor2.close();
            master.close();

            done();
        }, WAIT_TIME);
    });

    it('should forward the message to the right type monitors by notifyByType', function (done) {
        let monitorId1 = 'connector-server-1';
        let monitorId2 = 'connector-server-2';
        let monitorId3 = 'area-server-1';
        let monitorType1 = 'connector';
        let monitorType2 = 'area';
        let moduleId1 = 'testModuleId1';
        let moduleId2 = 'testModuleId2';
        let msg1 = {msg: 'message to monitorType1'};
        let msg2 = {msg: 'message to monitorType2'};

        let req1Count = 0;
        let req2Count = 0;
        let req3Count = 0;
        let reqType1Count = 0;
        let reqType2Count = 0;

        let monitorConsole1 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req1Count++;
                reqType1Count++;
                moduleId.should.eql(moduleId1);
                msg.should.eql(msg1);
            }
        };

        let monitorConsole2 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req2Count++;
                reqType1Count++;
                moduleId.should.eql(moduleId1);
                msg.should.eql(msg1);
            }
        };

        let monitorConsole3 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req3Count++;
                reqType2Count++;
                moduleId.should.eql(moduleId2);
                msg.should.eql(msg2);
            }
        };

        let master = new Master(masterConsole);
        let monitor1 = new Monitor({
            consoleService: monitorConsole1,
            id: monitorId1,
            type: monitorType1,
            info: {host: '127.0.0.1'}
        });
        let monitor2 = new Monitor({
            consoleService: monitorConsole2,
            id: monitorId2,
            type: monitorType1,
            info: {host: '127.0.0.1'}
        });
        let monitor3 = new Monitor({
            consoleService: monitorConsole3,
            id: monitorId3,
            type: monitorType2,
            info: {host: '127.0.0.1'}
        });

        master.listen(masterPort);
        flow.exec(function () {
                monitor1.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                monitor2.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                monitor3.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                master.notifyByType(monitorType1, moduleId1, msg1);
                master.notifyByType(monitorType2, moduleId2, msg2);
            });

        setTimeout(function () {
            req1Count.should.equal(1);
            req2Count.should.equal(1);
            req3Count.should.equal(1);
            reqType1Count.should.equal(2);
            reqType2Count.should.equal(1);

            monitor1.close();
            monitor2.close();
            monitor3.close();
            master.close();

            done();
        }, WAIT_TIME);
    });

    it('should forward the message to all monitors by notifyAll', function (done) {
        let monitorId1 = 'connector-server-1';
        let monitorId2 = 'area-server-1';
        let monitorType1 = 'connector';
        let monitorType2 = 'area';
        let orgModuleId = 'testModuleId';
        let orgMsg = {msg: 'message to all monitor'};

        let req1Count = 0;
        let req2Count = 0;

        let monitorConsole1 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req1Count++;
                orgModuleId.should.eql(moduleId);
                msg.should.eql(orgMsg);
            }
        };

        let monitorConsole2 = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                req2Count++;
                orgModuleId.should.eql(moduleId);
                msg.should.eql(orgMsg);
            }
        };

        let master = new Master(masterConsole);
        let monitor1 = new Monitor({
            consoleService: monitorConsole1,
            id: monitorId1,
            type: monitorType1,
            info: {host: '127.0.0.1'}
        });
        let monitor2 = new Monitor({
            consoleService: monitorConsole2,
            id: monitorId2,
            type: monitorType2,
            info: {host: '127.0.0.1'}
        });

        master.listen(masterPort);
        flow.exec(function () {
                monitor1.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                monitor2.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                master.notifyAll(orgModuleId, orgMsg);
            });

        setTimeout(function () {
            req1Count.should.equal(1);
            req2Count.should.equal(1);

            monitor1.close();
            monitor2.close();
            master.close();

            done();
        }, WAIT_TIME);
    });

    it('should push the message from monitor to master by notify', function (done) {
        let monitorId = 'connector-server-1';
        let monitorType = 'connector';
        let orgModuleId = 'testModuleId';
        let orgMsg = {msg: 'message to master'};

        let reqCount = 0;

        let masterConsole = {
            authServer: authServer,
            execute: function (moduleId, method, msg, cb) {
                reqCount++;
                orgModuleId.should.eql(moduleId);
                msg.should.eql(orgMsg);
            }
        };

        let monitorConsole = {
            authServer: authServer
        };

        let master = new Master(masterConsole);
        let monitor = new Monitor({
            consoleService: monitorConsole,
            id: monitorId,
            type: monitorType,
            info: {host: '127.0.0.1'}
        });

        master.listen(masterPort);
        flow.exec(function () {
                monitor.connect(masterPort, masterHost, this);
            },
            function (err) {
                should.not.exist(err);
                monitor.notify(orgModuleId, orgMsg);
            });

        setTimeout(function () {
            reqCount.should.equal(1);

            monitor.close();
            master.close();

            done();
        }, WAIT_TIME);
    });
});
