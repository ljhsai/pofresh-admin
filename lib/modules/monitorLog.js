/*!
 * pofresh -- consoleModule monitorLog
 * Copyright(c) 2020 luson <ljhxai@163.com>
 * MIT Licensed
 */
const logger = require('pofresh-logger').getLogger('pofresh-admin', __filename);
const exec = require('child_process').exec;
const path = require('path');

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
    exec('tail -n ' + number + ' ' + filePath, function (error, output) {
        let endOut = [];
        output = output.replace(/^\s+|\s+$/g, "").split(/\s+/);

        for (let i = 5; i < output.length; i += 6) {
            endOut.push(output[i]);
        }

        let endLength = endOut.length;
        for (let j = 0; j < endLength; j++) {
            let map = {};
            let json;
            try {
                json = JSON.parse(endOut[j]);
            } catch (e) {
                logger.error('the log cannot parsed to json, ' + e);
                continue;
            }
            map.time = json.time;
            map.route = json.route || json.service;
            map.serverId = serverId;
            map.timeUsed = json.timeUsed;
            map.params = endOut[j];
            endLogs.push(map);
        }

        callback({logfile: logfile, dataArray: endLogs});
    });
};

let getLogFileName = function (logfile, serverId) {
    return logfile + '-' + serverId + '.log';
};
