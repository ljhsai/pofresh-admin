/*!
 * pofresh -- commandLine Client
 * Copyright(c) 2015 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */

var EventEmitter = require('events').EventEmitter;
var MqttClient = require('../protocol/mqtt/mqttClient');
var SioClient = require('../protocol/socketio/sioClient');
var protocol = require('../util/protocol');
var utils = require('../util/utils');

var Client = function (opt) {
    EventEmitter.call(this);
    this.id = "";
    this.reqId = 1;
    this.callbacks = {};
    this.state = Client.ST_INITED;
    this.socket = null;
    opt = opt || {};
    this.username = opt.username || "";
    this.password = opt.password || "";
    this.md5 = opt.md5 || false;
    this.Client = opt.Client || SioClient;
};

utils.inherits(Client, EventEmitter);


Client.prototype = {
    connect: function (id, host, port, cb) {
        this.id = id;
        var self = this;

        this.socket = new this.Client({id: id});

        this.socket.on('connect', function () {
            self.state = Client.ST_CONNECTED;
            if (self.md5) {
                self.password = utils.md5(self.password);
            }
            self.socket.send('register', {
                type: "client",
                id: id,
                username: self.username,
                password: self.password,
                md5: self.md5
            });
        });

        this.socket.on('register', function (res) {
            if (res.code !== protocol.PRO_OK) {
                cb(res.msg);
                return;
            }

            self.state = Client.ST_REGISTERED;
            cb();
        });

        this.socket.on('client', function (msg) {
            msg = protocol.parse(msg);
            if (msg.respId) {
                // response for request
                var cb = self.callbacks[msg.respId];
                delete self.callbacks[msg.respId];
                if (cb && typeof cb === 'function') {
                    cb(msg.error, msg.body);
                }
            } else if (msg.moduleId) {
                // notify
                self.emit(msg.moduleId, msg);
            }
        });

        this.socket.on('error', function (err) {
            if (self.state < Client.ST_CONNECTED) {
                cb(err);
            }

            self.emit('error', err);
        });

        this.socket.on('disconnect', function (reason) {
            this.state = Client.ST_CLOSED;
            self.emit('close');
        });

        this.socket.connect(host, port);
    },

    request: function (moduleId, msg, cb) {
        var id = this.reqId++;
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        var req = protocol.composeRequest(id, moduleId, msg);
        this.callbacks[id] = cb;
        this.socket.send('client', req);
    },

    notify: function (moduleId, msg) {
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        var req = protocol.composeRequest(null, moduleId, msg);
        this.socket.send('client', req);
    },

    command: function (command, moduleId, msg, cb) {
        var id = this.reqId++;
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        var commandReq = protocol.composeCommand(id, command, moduleId, msg);
        this.callbacks[id] = cb;
        this.socket.send('client', commandReq);
    }
};

Client.ST_INITED = 1;
Client.ST_CONNECTED = 2;
Client.ST_REGISTERED = 3;
Client.ST_CLOSED = 4;

module.exports = Client;