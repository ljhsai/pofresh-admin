/*!
 * pofresh -- consoleModule nodeInfo processInfo
 * Copyright(c) 2020 luson <ljhxai@163.com>
 * MIT Licensed
 */
const monitor = require('pofresh-monitor');
const logger = require('pofresh-logger').getLogger('pofresh-admin', __filename);

const DEFAULT_INTERVAL = 5 * 60;		// in second
const DEFAULT_DELAY = 10;			    // in second

const moduleId = 'nodeInfo';

module.exports = function (opts) {
    return new Module(opts);
};

module.exports.moduleId = moduleId;

class Module {
    constructor(opts) {
        opts = opts || {};
        this.type = opts.type || 'pull';
        this.interval = opts.interval || DEFAULT_INTERVAL;
        this.delay = opts.delay || DEFAULT_DELAY;
    }

    monitorHandler(agent, msg, cb) {
        let serverId = agent.id;
        let pid = process.pid;
        let params = {
            serverId: serverId,
            pid: pid
        };
        monitor.psmonitor.getPsInfo(params, (err, data) => {
            agent.notify(moduleId, {serverId: agent.id, body: data});
        });

    }

    masterHandler(agent, msg, cb) {
        if (!msg) {
            agent.notifyAll(moduleId);
            return;
        }

        let body = msg.body;
        let data = agent.get(moduleId);
        if (!data) {
            data = {};
            agent.set(moduleId, data);
        }

        data[msg.serverId] = body;
    }

    clientHandler(agent, msg, cb) {
        cb(null, agent.get(moduleId) || {});
    }
}
