var logger = require('pofresh-logger').getLogger('pofresh-admin', 'SIOClient');
var EventEmitter = require('events').EventEmitter;
var constants = require('../../util/constants');
var IOClient = require('socket.io-client');
var Util = require('util');

var SIOClient = function (opts) {
    EventEmitter.call(this);
    this.clientId = 'SOCKET_ADMIN_' + Date.now();
    this.id = opts.id;
    this.host = null;
    this.port = null;
    this.socket = null;
    this.closed = false;
    this.connected = false;
    this.reconnectDelay = opts.reconnectDelay || constants.RECONNECT_DELAY;
    this.reconnectDelayMax = opts.reconnectDelayMax || constants.DEFAULT_PARAM.RECONNECT_DELAY_MAX;
    this.timeout = opts.timeout || constants.DEFAULT_PARAM.TIMEOUT;
    this.keepalive = opts.keepalive || constants.DEFAULT_PARAM.KEEPALIVE;
}

Util.inherits(SIOClient, EventEmitter);

SIOClient.prototype.connect = function (host, port, cb) {
    cb = cb || function () {
    };

    if (this.connected) {
        return cb(new Error('SIOClient has already connected.'));
    }

    if (host) {
        this.host = host;
    } else {
        host = this.host;
    }

    if (port) {
        this.port = port;
    } else {
        port = this.port;
    }

    var self = this;
    this.closed = false;

    this.socket = IOClient('http://' + host + ':' + port, {
        forceNew: true,
        reconnection: false,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: this.reconnectDelayMax,
        timeout: this.timeout
    });

    this.socket.on('register', function (msg) {
        self.emit('register', JSON.parse(msg));
    });

    this.socket.on('monitor', function (msg) {
        self.emit('monitor', JSON.parse(msg));
    });

    this.socket.on('client', function (msg) {
        self.emit('client', JSON.parse(msg));
    });

    this.socket.on('reconnect_ok', function () {
        self.emit('reconnect_ok');
    });

    this.socket.on('connect', function () {
        if (self.connected) return;
        self.connected = true;
        self.emit('connect');
        cb();
    });

    this.socket.on('reconnect', function () {
        self.emit('reconnect');
    });

    this.socket.on('error', function (err) {
        self.emit('error', new Error('[SIOClient] socket is error, remote server ' + host + ':' + port));
        self.onSocketClose();
    });

    this.socket.on('connect_error', function (err) {
        // logger.error('socket is error, remote server host: %s, port: %s', host, port);
        self.emit('error', new Error('[SIOClient] socket is connect error, remote server ' + host + ':' + port));
        self.onSocketClose();
    });

    this.socket.on('reconnect_error', function (err) {

    });

    this.socket.on('reconnect_failed', function () {
        self.emit('error', new Error('[SIOClient] socket reconnect_failed, remote server ' + host + ':' + port));
        self.onSocketClose();
    });

    this.socket.on('disconnect', function () {
        logger.error('socket is disconnect, remote server host: %s, port: %s', host, port);
        self.emit('disconnect', self.id);
        self.onSocketClose();
    });

    this.socket.on('connect_timeout', function (timeout) {
        logger.error('sio client connect %s:%d timeout %d s', self.host, self.port, self.timeout / 1000);
        self.emit('timeout', timeout);
    });
}

SIOClient.prototype.send = function (topic, msg) {
    this.socket.emit(topic, msg);
}

SIOClient.prototype.onSocketClose = function () {
    if (this.closed) {
        return;
    }

    this.connected = false;
    this.closed = true;
    delete this.socket;
    this.socket = null;
};

SIOClient.prototype.disconnect = function () {
    this.connected = false;
    this.closed = true;
    this.socket.close();
};

SIOClient.prototype.exit = function () {
    process.exit(0);
}

module.exports = SIOClient;