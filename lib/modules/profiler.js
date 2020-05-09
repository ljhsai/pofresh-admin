const logger = require('pofresh-logger').getLogger('pofresh-admin', __filename);
const utils = require('../util/utils');

let profiler = null;
try {
    profiler = require('v8-profiler');
} catch (e) {
}

const fs = require('fs');
const ProfileProxy = require('../util/profileProxy');

module.exports = function (opts) {
    if (!profiler) {
        return {};
    } else {
        return new Module(opts);
    }
};

if (!profiler) {
    module.exports.moduleError = 1;
}

const moduleId = 'profiler';

module.exports.moduleId = moduleId;

class Module {
    constructor(opts) {
        if (opts && opts.isMaster) {
            this.proxy = new ProfileProxy();
        }
    }

    monitorHandler(agent, msg, cb) {
        let type = msg.type, action = msg.action, uid = msg.uid, result = null;
        if (type === 'CPU') {
            if (action === 'start') {
                profiler.startProfiling();
            } else {
                result = profiler.stopProfiling();
                let res = {};
                res.head = result.getTopDownRoot();
                res.bottomUpHead = result.getBottomUpRoot();
                res.msg = msg;
                agent.notify(moduleId, {clientId: msg.clientId, type: type, body: res});
            }
        } else {
            let snapshot = profiler.takeSnapshot();
            let appBase = path.dirname(require.main.filename);
            let name = appBase + '/logs/' + utils.format(new Date()) + '.log';
            let log = fs.createWriteStream(name, {'flags': 'a'});
            let data;
            snapshot.serialize({
                onData: function (chunk, size) {
                    chunk = chunk + '';
                    data = {
                        method: 'Profiler.addHeapSnapshotChunk',
                        params: {
                            uid: uid,
                            chunk: chunk
                        }
                    };
                    log.write(chunk);
                    agent.notify(moduleId, {clientId: msg.clientId, type: type, body: data});
                },
                onEnd: function () {
                    agent.notify(moduleId, {
                        clientId: msg.clientId,
                        type: type,
                        body: {params: {uid: uid}}
                    });
                    profiler.deleteAllSnapshots();
                }
            });
        }
    }

    masterHandler(agent, msg, cb) {
        if (msg.type === 'CPU') {
            this.proxy.stopCallBack(msg.body, msg.clientId, agent);
        } else {
            this.proxy.takeSnapCallBack(msg.body);
        }
    }

    clientHandler(agent, msg, cb) {
        if (msg.action === 'list') {
            list(agent, msg, cb);
            return;
        }

        if (typeof msg === 'string') {
            msg = JSON.parse(msg);
        }
        let id = msg.id;
        let command = msg.method.split('.');
        let method = command[1];
        let params = msg.params;
        let clientId = msg.clientId;

        if (!this.proxy[method] || typeof this.proxy[method] !== 'function') {
            return;
        }

        this.proxy[method](id, params, clientId, agent);
    }
}


let list = function (agent, msg, cb) {
    let servers = [];
    let idMap = agent.idMap;

    for (let sid in idMap) {
        servers.push(sid);
    }
    cb(null, servers);
};
