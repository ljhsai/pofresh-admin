const logger = require('pofresh-logger').getLogger('pofresh-admin', 'MonitorAgent');
const Client = require('../protocol/socketio/sioClient');
const EventEmitter = require('events');
const protocol = require('../util/protocol');

const ST_INITED = 1;
const ST_CONNECTED = 2;
const ST_REGISTERED = 3;
const ST_CLOSED = 4;
const STATUS_INTERVAL = 5 * 1000; // 60 seconds

/**
 * MonitorAgent Constructor
 *
 * @class MasterAgent
 * @constructor
 * @param {Object} opts construct parameter
 *                 opts.consoleService {Object} consoleService
 *                 opts.id             {String} server id
 *                 opts.type           {String} server type, 'master', 'connector', etc.
 *                 opts.info           {Object} more server info for current server, {id, serverType, host, port}
 * @api public
 */
class MonitorAgent extends EventEmitter {
    constructor(opts) {
        super();
        this.reqId = 1;
        this.opts = opts;
        this.id = opts.id;
        this.socket = null;
        this.callbacks = {};
        this.type = opts.type;
        this.info = opts.info;
        this.state = ST_INITED;
        this.consoleService = opts.consoleService;
        this.Client = opts.Client || Client;
    }

    /**
     * register and connect to master server
     *
     * @param {String} port
     * @param {String} host
     * @param {Function} cb callback function
     * @api public
     */
    connect(port, host, cb) {
        if (this.state > ST_INITED) {
            logger.error('monitor client has connected or closed.');
            return;
        }

        cb = cb || function () {
        };

        this.socket = new this.Client(this.opts);

        this.socket.on('register', (msg) => {
            if (msg && msg.code === protocol.PRO_OK) {
                this.state = ST_REGISTERED;
                cb();
            } else {
                this.emit('close');
                logger.error('server %j %j register master failed', this.id, this.type);
            }
        });

        this.socket.on('monitor', (msg) => {
            if (this.state !== ST_REGISTERED) {
                return;
            }

            msg = protocol.parse(msg);

            if (msg.command) {
                // a command from master
                this.consoleService.command(msg.command, msg.moduleId, msg.body, (err, res) => {
                    //notify should not have a callback
                });
            } else {
                let respId = msg.respId;
                if (respId) {
                    // a response from monitor
                    let respCb = this.callbacks[respId];
                    if (!respCb) {
                        logger.warn('unknown resp id:' + respId);
                        return;
                    }
                    delete this.callbacks[respId];
                    respCb(msg.error, msg.body);
                    return;
                }

                // request from master
                this.consoleService.execute(msg.moduleId, 'monitorHandler', msg.body, (err, res) => {
                    if (protocol.isRequest(msg)) {
                        let resp = protocol.composeResponse(msg, err, res);
                        if (resp) {
                            this.socket.send('monitor', resp);
                        }
                    } else {
                        //notify should not have a callback
                        logger.error('notify should not have a callback.');
                    }
                });
            }
        });

        this.socket.on('connect', () => {
            if (this.state > ST_INITED) {
                //ignore reconnect
                return;
            }
            this.state = ST_CONNECTED;
            let req = {
                id: this.id,
                type: 'monitor',
                serverType: this.type,
                pid: process.pid,
                info: this.info
            };
            let authServer = this.consoleService.authServer;
            let env = this.consoleService.env;
            authServer(req, env, (token) => {
                req.token = token;
                this.socket.send('register', req);
            });
        });

        this.socket.on('error', (err) => {
            if (this.state < ST_CONNECTED) {
                // error occurs during connecting stage
                cb(err);
            } else {
                this.emit('error', err);
            }
        });

        this.socket.on('disconnect', (reason) => {
            this.state = ST_CLOSED;
            this.emit('close');
        });

        this.socket.on('reconnect', () => {
            this.state = ST_CONNECTED;
            let req = {
                id: this.id,
                type: 'monitor',
                info: this.info,
                pid: process.pid,
                serverType: this.type
            };

            this.socket.send('reconnect', req);
        });

        this.socket.on('reconnect_ok', (msg) => {
            if (msg && msg.code === protocol.PRO_OK) {
                this.state = ST_REGISTERED;
            }
        });

        this.socket.connect(host, port);
    }

    /**
     * close monitor agent
     *
     * @api public
     */
    close() {
        if (this.state >= ST_CLOSED) {
            return;
        }
        this.state = ST_CLOSED;
        this.socket.disconnect();
    }

    /**
     * set module
     *
     * @param {String} moduleId module id/name
     * @param {Object} value module object
     * @api public
     */
    set(moduleId, value) {
        this.consoleService.set(moduleId, value);
    }

    /**
     * get module
     *
     * @param {String} moduleId module id/name
     * @api public
     */
    get(moduleId) {
        return this.consoleService.get(moduleId);
    }

    /**
     * notify master server without callback
     *
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api public
     */
    notify(moduleId, msg) {
        if (this.state !== ST_REGISTERED) {
            logger.error('agent can not notify now, state:' + this.state);
            return;
        }
        this.socket.send('monitor', protocol.composeRequest(null, moduleId, msg));
        // this.socket.emit('monitor', protocol.composeRequest(null, moduleId, msg));
    }

    request(moduleId, msg, cb) {
        if (this.state !== ST_REGISTERED) {
            logger.error('agent can not request now, state:' + this.state);
            return;
        }
        let reqId = this.reqId++;
        this.callbacks[reqId] = cb;
        this.socket.send('monitor', protocol.composeRequest(reqId, moduleId, msg));
        // this.socket.emit('monitor', protocol.composeRequest(reqId, moduleId, msg));
    }
}

module.exports = MonitorAgent;
