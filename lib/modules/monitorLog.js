/*!
 * pofresh -- consoleModule monitorLog
 * Copyright(c) 2020 luson <ljhxai@163.com>
 * MIT Licensed
 */
const logger = require('pofresh-logger').getLogger('pofresh-admin', __filename);
const path = require('path');
const tail = require('tail-num').default;

const DEFAULT_INTERVAL = 5 * 60;		// in second

module.exports = function (opts) {
    return new Module(opts);
};

module.exports.moduleId = 'monitorLog';

/**
 * Initialize a new 'Module' with the given 'opts'
 *
 * @class Module
 * @constructor
 * @param {object} opts
 * @api public
 */
class Module {
    constructor(opts) {
        opts = opts || {};
        this.root = opts.path;
        this.interval = opts.interval || DEFAULT_INTERVAL;
    }

    /**
     * collect monitor data from monitor
     *
     * @param {Object} agent monitorAgent object
     * @param {Object} msg client message
     * @param {Function} cb callback function
     * @api public
     */
    monitorHandler(agent, msg, cb) {
        if (!msg.logfile) {
            cb(new Error('logfile should not be empty'));
            return;
        }

        let serverId = agent.id;
        fetchLogs(this.root, msg, function (data) {
            cb(null, {serverId: serverId, body: data});
        });
    }

    /**
     * Handle client request
     *
     * @param {Object} agent masterAgent object
     * @param {Object} msg client message
     * @param {Function} cb callback function
     * @api public
     */
    clientHandler(agent, msg, cb) {
        agent.request(msg.serverId, module.exports.moduleId, msg, function (err, res) {
            if (err) {
                logger.error('fail to run log for ' + err.stack);
                return;
            }
            cb(null, res);
        });
    }
}

//get the latest logs
let fetchLogs = function (root, msg, callback) {
    let number = msg.number;
    let logfile = msg.logfile;
    let serverId = msg.serverId;
    let filePath = path.join(root, getLogFileName(logfile, serverId));

    let endLogs = [];
    tail(filePath, number).then(function (output) {
        for (let i = 0; i < output.length; i++) {
            let item = output[i];
            let log = '';
            let last = '';
            if(logfile === 'rpc-debug'){
                last = item.slice(item.indexOf('{'));
            }else {
                log = item.replace(/^\s+|\s+$/g, "").split(/\s+/);
                last = log[log.length - 1];
            }

            if (last) {
                if (last.indexOf('\u001b') !== -1) {
                    last = last.slice(last.indexOf('m') + 1);
                }

                let json = {};
                try {
                    json = JSON.parse(last);
                } catch (e) {
                    continue;
                }
                json.route = json.route || json.service;
                json.serverId = serverId;
                json.params = last;
                endLogs.push(json);
            }
        }

        callback({logfile: logfile, dataArray: endLogs});
    });
};

let getLogFileName = function (logfile, serverId) {
    return logfile + '-' + serverId + '.log';
};
