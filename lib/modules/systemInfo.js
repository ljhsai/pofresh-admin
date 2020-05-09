/*!
 * pofresh -- consoleModule systemInfo
 * Copyright(c) 2020 luson <ljhxai@163.com>
 * MIT Licensed
 */
const monitor = require('pofresh-monitor');
const logger = require('pofresh-logger').getLogger('pofresh-admin', __filename);

const DEFAULT_INTERVAL = 5 * 60;		// in second
const DEFAULT_DELAY = 10;						// in second

const moduleId = 'systemInfo';

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
        //collect data
        monitor.sysmonitor.getSysInfo((err, data) => {
            agent.notify(moduleId, {serverId: agent.id, body: data});
        });
    }

    masterHandler(agent, msg) {
        if (!msg) {
            agent.notifyAll(moduleId);
            return;
        }

        let body = msg.body;

        let oneData = {
            Time: body.iostat.date,
            hostname: body.hostname,
            serverId: msg.serverId,
            cpu_user: body.iostat.cpu.cpu_user,
            cpu_nice: body.iostat.cpu.cpu_nice,
            cpu_system: body.iostat.cpu.cpu_system,
            cpu_iowait: body.iostat.cpu.cpu_iowait,
            cpu_steal: body.iostat.cpu.cpu_steal,
            cpu_idle: body.iostat.cpu.cpu_idle,
            tps: body.iostat.disk.tps,
            kb_read: body.iostat.disk.kb_read,
            kb_wrtn: body.iostat.disk.kb_wrtn,
            kb_read_per: body.iostat.disk.kb_read_per,
            kb_wrtn_per: body.iostat.disk.kb_wrtn_per,
            totalmem: body.totalmem,
            freemem: body.freemem,
            'free/total': (body.freemem / body.totalmem),
            m_1: body.loadavg[0],
            m_5: body.loadavg[1],
            m_15: body.loadavg[2]
        };

        let data = agent.get(moduleId);
        if (!data) {
            data = {};
            agent.set(moduleId, data);
        }

        data[msg.serverId] = oneData;
    }

    clientHandler(agent, msg, cb) {
        cb(null, agent.get(moduleId) || {});
    }
}
