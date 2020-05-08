const logger = require('pofresh-logger').getLogger('pofresh-admin', 'MasterAgent');
const EventEmitter = require('events');
const Server = require('../protocol/socketio/sioServer');
const MasterSocket = require('./masterSocket');
const protocol = require('../util/protocol');
const utils = require('../util/utils');

const ST_INITED = 1;
const ST_STARTED = 2;
const ST_CLOSED = 3;

/**
 * MasterAgent Constructor
 *
 * @class MasterAgent
 * @constructor
 * @param {Object} opts construct parameter
 *                 opts.consoleService {Object} consoleService
 *                 opts.id             {String} server id
 *                 opts.type           {String} server type, 'master', 'connector', etc.
 *                 opts.socket         {Object} socket-io object
 *                 opts.reqId          {Number} reqId add by 1
 *                 opts.callbacks      {Object} callbacks
 *                 opts.state          {Number} MasterAgent state
 * @api public
 */
class MasterAgent extends EventEmitter {
    constructor(consoleService, opts) {
        super();
        opts = opts || {};
        this.reqId = 1;
        this.idMap = {};
        this.msgMap = {};
        this.typeMap = {};
        this.clients = {};
        this.sockets = {};
        this.slaveMap = {};
        this.callbacks = {};
        this.server = null;
        this.state = ST_INITED;
        this.whitelist = opts.whitelist;
        this.consoleService = consoleService;
        this.ServerClass = opts.Server || Server;
    }

    /**
     * master listen to a port and handle register and request
     *
     * @param {String} port
     * @api public
     */
    listen(port, cb) {
        if (this.state > ST_INITED) {
            logger.error('master agent has started or closed.');
            return;
        }

        this.state = ST_STARTED;
        this.server = new this.ServerClass();
        cb = cb || function () {
        };

        this.server.on('error', (err) => {
            this.emit('error', err);
            cb(err);
        });

        this.server.once('listening', () => {
            setImmediate(function () {
                cb();
            });
        });

        this.server.on('connection', (socket) => {
            var masterSocket = new MasterSocket(this, socket);
            this.sockets[socket.id] = socket;
        });

        this.server.listen(port);
    }

    /**
     * close master agent
     *
     * @api public
     */
    close() {
        if (this.state > ST_STARTED) {
            return;
        }
        this.state = ST_CLOSED;
        this.server.close();
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
     * getClientById
     *
     * @param {String} clientId
     * @api public
     */
    getClientById(clientId) {
        return this.clients[clientId];
    }

    /**
     * request monitor{master node} data from monitor
     *
     * @param {String} serverId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @param {Function} callback function
     * @api public
     */
    request(serverId, moduleId, msg, cb) {
        if (this.state > ST_STARTED) {
            return false;
        }

        cb = cb || function () {
        };

        var curId = this.reqId++;
        this.callbacks[curId] = cb;

        if (!this.msgMap[serverId]) {
            this.msgMap[serverId] = {};
        }

        this.msgMap[serverId][curId] = {
            moduleId: moduleId,
            msg: msg
        };

        var record = this.idMap[serverId];
        if (!record) {
            cb(new Error('unknown server id:' + serverId));
            return false;
        }

        this.sendToMonitor(record.socket, curId, moduleId, msg);

        return true;
    }

    /**
     * request server data from monitor by serverInfo{host:port}
     *
     * @param {String} serverId
     * @param {Object} serverInfo
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @param {Function} callback function
     * @api public
     */
    requestServer(serverId, serverInfo, moduleId, msg, cb) {
        if (this.state > ST_STARTED) {
            return false;
        }

        var record = this.idMap[serverId];
        if (!record) {
            utils.invokeCallback(cb, new Error('unknown server id:' + serverId));
            return false;
        }

        var curId = this.reqId++;
        this.callbacks[curId] = cb;

        if (utils.compareServer(record, serverInfo)) {
            this.sendToMonitor(record.socket, curId, moduleId, msg);
        } else {
            var slaves = this.slaveMap[serverId];
            for (var i = 0, l = slaves.length; i < l; i++) {
                if (utils.compareServer(slaves[i], serverInfo)) {
                    this.sendToMonitor(slaves[i].socket, curId, moduleId, msg);
                    break;
                }
            }
        }

        return true;
    }

    /**
     * notify a monitor{master node} by id without callback
     *
     * @param {String} serverId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyById(serverId, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }

        var record = this.idMap[serverId];
        if (!record) {
            logger.error('fail to notifyById for unknown server id:' + serverId);
            return false;
        }

        this.sendToMonitor(record.socket, null, moduleId, msg);

        return true;
    }

    /**
     * notify a monitor by server{host:port} without callback
     *
     * @param {String} serverId
     * @param {Object} serverInfo{host:port}
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyByServer(serverId, serverInfo, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }

        var record = this.idMap[serverId];
        if (!record) {
            logger.error('fail to notifyByServer for unknown server id:' + serverId);
            return false;
        }

        if (utils.compareServer(record, serverInfo)) {
            this.sendToMonitor(record.socket, null, moduleId, msg);
        } else {
            var slaves = this.slaveMap[serverId];
            for (var i = 0, l = slaves.length; i < l; i++) {
                if (utils.compareServer(slaves[i], serverInfo)) {
                    this.sendToMonitor(slaves[i].socket, null, moduleId, msg);
                    break;
                }
            }
        }
        return true;
    }

    /**
     * notify slaves by id without callback
     *
     * @param {String} serverId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifySlavesById(serverId, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }

        var slaves = this.slaveMap[serverId];
        if (!slaves || slaves.length === 0) {
            logger.error('fail to notifySlavesById for unknown server id:' + serverId);
            return false;
        }

        this.broadcastMonitors(slaves, moduleId, msg);
        return true;
    }

    /**
     * notify monitors by type without callback
     *
     * @param {String} type serverType
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyByType(type, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }

        var list = this.typeMap[type];
        if (!list || list.length === 0) {
            logger.error('fail to notifyByType for unknown server type:' + type);
            return false;
        }
        this.broadcastMonitors(list, moduleId, msg);
        return true;
    }

    /**
     * notify all the monitors without callback
     *
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyAll(moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        this.broadcastMonitors(this.idMap, moduleId, msg);
        return true;
    }

    /**
     * notify a client by id without callback
     *
     * @param {String} clientId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyClient(clientId, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }

        var record = this.clients[clientId];
        if (!record) {
            logger.error('fail to notifyClient for unknown client id:' + clientId);
            return false;
        }
        this.sendToClient(record.socket, null, moduleId, msg);
    }

    notifyCommand(command, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        this.broadcastCommand(this.idMap, command, moduleId, msg);
        return true;
    }

    doAuthUser(msg, socket, cb) {
        if (!msg.id) {
            // client should has a client id
            return cb(new Error('client should has a client id'));
        }

        var username = msg.username;
        if (!username) {
            // client should auth with username
            socket.send('register', {
                code: protocol.PRO_FAIL,
                msg: 'client should auth with username'
            });
            return cb(new Error('client should auth with username'));
        }

        var env = this.consoleService.env;
        this.consoleService.authUser(msg, env, (user) => {
            if (!user) {
                // client should auth with username
                socket.send('register', {
                    code: protocol.PRO_FAIL,
                    msg: 'client auth failed with username or password error'
                });
                return cb(new Error('client auth failed with username or password error'));
            }

            if (this.clients[msg.id]) {
                socket.send('register', {
                    code: protocol.PRO_FAIL,
                    msg: 'id has been registered. id:' + msg.id
                });
                return cb(new Error('id has been registered. id:' + msg.id));
            }

            logger.info('client user : ' + username + ' login to master');
            this.addConnection(this, msg.id, msg.type, null, user, socket);
            socket.send('register', {
                code: protocol.PRO_OK,
                msg: 'ok'
            });

            cb();
        });
    }

    doAuthServer(msg, socket, cb) {
        var env = this.consoleService.env;
        this.consoleService.authServer(msg, env, (status) => {
            if (status !== 'ok') {
                socket.send('register', {
                    code: protocol.PRO_FAIL,
                    msg: 'server auth failed'
                });
                cb(new Error('server auth failed'));
                return;
            }

            var record = this.addConnection(this, msg.id, msg.serverType, msg.pid, msg.info, socket);

            socket.send('register', {
                code: protocol.PRO_OK,
                msg: 'ok'
            });
            msg.info = msg.info || {};
            msg.info.pid = msg.pid;
            this.emit('register', msg.info);
            cb(null);
        });
    }


    /**
     * add monitor,client to connection -- idMap
     *
     * @param {Object} agent agent object
     * @param {String} id
     * @param {String} type serverType
     * @param {Object} socket socket-io object
     * @api private
     */
    addConnection(agent, id, type, pid, info, socket) {
        var record = {
            id: id,
            type: type,
            pid: pid,
            info: info,
            socket: socket
        };
        if (type === 'client') {
            agent.clients[id] = record;
        } else {
            if (!agent.idMap[id]) {
                agent.idMap[id] = record;
                var list = agent.typeMap[type] = agent.typeMap[type] || [];
                list.push(record);
            } else {
                var slaves = agent.slaveMap[id] = agent.slaveMap[id] || [];
                slaves.push(record);
            }
        }
        return record;
    }

    /**
     * remove monitor,client connection -- idMap
     *
     * @param {Object} agent agent object
     * @param {String} id
     * @param {String} type serverType
     * @api private
     */
    removeConnection(agent, id, type, info) {
        if (type === 'client') {
            delete agent.clients[id];
        } else {
            // remove master node in idMap and typeMap
            var record = agent.idMap[id];
            if (!record) {
                return;
            }
            var _info = record.info; // info {host, port}
            if (utils.compareServer(_info, info)) {
                delete agent.idMap[id];
                var list = agent.typeMap[type];
                if (list) {
                    for (var i = 0, l = list.length; i < l; i++) {
                        if (list[i].id === id) {
                            list.splice(i, 1);
                            break;
                        }
                    }
                    if (list.length === 0) {
                        delete agent.typeMap[type];
                    }
                }
            } else {
                // remove slave node in slaveMap
                var slaves = agent.slaveMap[id];
                if (slaves) {
                    for (var i = 0, l = slaves.length; i < l; i++) {
                        if (utils.compareServer(slaves[i].info, info)) {
                            slaves.splice(i, 1);
                            break;
                        }
                    }
                    if (slaves.length === 0) {
                        delete agent.slaveMap[id];
                    }
                }
            }
        }
    }

    /**
     * send msg to monitor
     *
     * @param {Object} socket socket-io object
     * @param {Number} reqId request id
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api private
     */
    sendToMonitor(socket, reqId, moduleId, msg) {
        socket.send('monitor', protocol.composeRequest(reqId, moduleId, msg));
    }

    /**
     * send msg to client
     *
     * @param {Object} socket socket-io object
     * @param {Number} reqId request id
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api private
     */
    sendToClient(socket, reqId, moduleId, msg) {
        socket.send('client', protocol.composeRequest(reqId, moduleId, msg));
    }

    /**
     * broadcast msg to monitor
     *
     * @param {Object} record registered modules
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api private
     */
    broadcastMonitors(records, moduleId, msg) {
        msg = protocol.composeRequest(null, moduleId, msg);

        if (records instanceof Array) {
            for (var i = 0, l = records.length; i < l; i++) {
                records[i].socket.send('monitor', msg);
            }
        } else {
            for (var id in records) {
                records[id].socket.send('monitor', msg);
            }
        }
    }

    broadcastCommand(records, command, moduleId, msg) {
        msg = protocol.composeCommand(null, command, moduleId, msg);

        if (records instanceof Array) {
            for (var i = 0, l = records.length; i < l; i++) {
                records[i].socket.send('monitor', msg);
            }
        } else {
            for (var id in records) {
                records[id].socket.send('monitor', msg);
            }
        }
    }
}

module.exports = MasterAgent;
