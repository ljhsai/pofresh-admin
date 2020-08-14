/*!
 * pofresh -- commandLine Client
 * Copyright(c) 2020 luson <ljhxai@163.com>
 * MIT Licensed
 */

const EventEmitter = require('events');
const client = require('../protocol/socketio/sioClient');
const protocol = require('../util/protocol');
const utils = require('../util/utils');

class Client extends EventEmitter {
    constructor(opt) {
        super();
        this.id = "";
        this.reqId = 1;
        this.callbacks = {};
        this.state = Client.ST_INITED;
        this.socket = null;
        opt = opt || {};
        this.username = opt.username || "";
        this.password = opt.password || "";
        this.md5 = opt.md5 || false;
        this.Client = opt.Client || client;
    }

    connect(id, host, port, cb) {

        console.log('try to connect ' + host + ':' + port);

        this.id = id;

        this.socket = new this.Client({id: id});

        this.socket.on('connect', () => {
            this.state = Client.ST_CONNECTED;
            if (this.md5) {
                this.password = utils.md5(this.password);
            }
            this.socket.send('register', {
                type: "client",
                id: id,
                username: this.username,
                password: this.password,
                md5: this.md5
            });
        });

        this.socket.on('register', (res) => {
            if (res.code !== protocol.PRO_OK) {
                cb(res.msg);
                return;
            }

            this.state = Client.ST_REGISTERED;
            cb();
        });

        this.socket.on('client', (msg) => {
            msg = protocol.parse(msg);
            if (msg.respId) {
                // response for request
                let cb = this.callbacks[msg.respId];
                delete this.callbacks[msg.respId];
                if (cb && typeof cb === 'function') {
                    cb(msg.error, msg.body);
                }
            } else if (msg.moduleId) {
                // notify
                this.emit(msg.moduleId, msg);
            }
        });

        this.socket.on('error', (err) => {
            if (this.state < Client.ST_CONNECTED) {
                cb(err);
            }
            this.emit('error', err);
        });

        this.socket.on('disconnect', (reason) => {
            this.state = Client.ST_CLOSED;
            // this.socket.exit();
        });

        this.socket.connect(host, port);
    }

    request(moduleId, msg, cb) {
        let id = this.reqId++;
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        let req = protocol.composeRequest(id, moduleId, msg);
        this.callbacks[id] = cb;
        this.socket.send('client', req);
    }

    notify(moduleId, msg) {
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        let req = protocol.composeRequest(null, moduleId, msg);
        this.socket.send('client', req);
    }

    command(command, moduleId, msg, cb) {
        let id = this.reqId++;
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        let commandReq = protocol.composeCommand(id, command, moduleId, msg);
        this.callbacks[id] = cb;
        this.socket.send('client', commandReq);
    }
}

Client.ST_INITED = 1;
Client.ST_CONNECTED = 2;
Client.ST_REGISTERED = 3;
Client.ST_CLOSED = 4;

module.exports = Client;
