var logger = require('pofresh-logger').getLogger('pofresh-admin', 'SIOClient');
var EventEmitter = require('events').EventEmitter;
var constants = require('../../util/constants');
var IOClient = require('socket.io-client');
var Util = require('util');

var SIOClient = function (opts) {
    EventEmitter.call(this);
    this.clientId = 'SOCKET_ADMIN_' + Date.now();
    this.id = opts.id;
    this.connectedTimes = 1;
    this.host = null;
    this.port = null;
    this.socket = null;
    this.lastPing = -1;
    this.lastPong = -1;
    this.closed = false;
    this.timeoutId = null;
    this.connected = false;
    this.reconnectId = null;
    this.timeoutFlag = false;
    this.keepaliveTimer = null;
    this.reconnectDelay = 0;
    this.reconnectDelayMax = opts.reconnectDelayMax || constants.DEFAULT_PARAM.RECONNECT_DELAY_MAX;
    this.timeout = opts.timeout || constants.DEFAULT_PARAM.TIMEOUT;
    this.keepalive = opts.keepalive || constants.DEFAULT_PARAM.KEEPALIVE;
}

Util.inherits(SIOClient, EventEmitter);

SIOClient.prototype.connect = function (host, port, cb) {
    cb = cb || function () {
    }
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
        'force new connection': true,
        'reconnect': false
    });

    this.addTimeout();

    this.socket.on('connect', function () {
        console.log('test connect')
        if (self.connected) {
            return;
        }

        self.connected = true;

        self.setupKeepAlive();

        if (self.connectedTimes++ === 1) {
            self.emit('connect');
            cb();
        } else {
            self.emit('reconnect');
        }
    });

    this.socket.on('publish', function (pkg) {
        var topic = pkg.topic;
        var msg = pkg.payload.toString();
        msg = JSON.parse(msg);
        // logger.debug('[sioClient] publish %s %j', topic, msg);
        self.emit(topic, msg);
    });

    this.socket.on('close', function () {
        logger.error('socket is close, remote server host: %s, port: %s', host, port);
        self.onSocketClose();
    });

    this.socket.on('connect_error', function (err) {
        logger.error('socket is error, remote server host: %s, port: %s', host, port);
        self.emit('error', new Error('[SIOClient] socket is error, remote server ' + host + ':' + port));
        self.onSocketClose();
    });

    this.socket.on('pingresp', function () {
        self.lastPong = Date.now();
    });

    this.socket.on('disconnect', function () {
        logger.error('socket is disconnect, remote server host: %s, port: %s', host, port);
        self.emit('disconnect', self.id);
        self.onSocketClose();
    });

    this.socket.on('timeout', function (reconnectFlag) {
        if (reconnectFlag) {
            self.reconnect();
        } else {
            self.exit();
        }
    });
}

SIOClient.prototype.send = function (topic, msg) {
    // console.log('SIOClient send %s %j ~~~', topic, msg);
    this.socket.send({
        topic: topic,
        payload: JSON.stringify(msg)
    });
}

SIOClient.prototype.onSocketClose = function () {
    // console.log('onSocketClose ' + this.closed);
    if (this.closed) {
        return;
    }

    clearInterval(this.keepaliveTimer);
    clearTimeout(this.timeoutId);
    this.keepaliveTimer = null;
    this.lastPing = -1;
    this.lastPong = -1;
    this.connected = false;
    this.closed = true;
    delete this.socket;
    this.socket = null;

    if (this.connectedTimes > 1) {
        this.reconnect();
    } else {
        this.exit();
    }
}

SIOClient.prototype.addTimeout = function (reconnectFlag) {
    var self = this;
    if (this.timeoutFlag) {
        return;
    }

    this.timeoutFlag = true;

    this.timeoutId = setTimeout(function () {
        self.timeoutFlag = false;
        logger.error('sio client connect %s:%d timeout %d s', self.host, self.port, self.timeout / 1000);
        self.socket.emit('timeout', reconnectFlag);
    }, self.timeout);
}

SIOClient.prototype.reconnect = function () {
    var delay = this.reconnectDelay * 2 || constants.DEFAULT_PARAM.RECONNECT_DELAY;
    if (delay > this.reconnectDelayMax) {
        delay = this.reconnectDelayMax;
    }

    this.reconnectDelay = delay;

    var self = this;

    // logger.debug('[SIOClient] reconnect %d ...', delay);
    this.reconnectId = setTimeout(function () {
        logger.info('reconnect delay %d s', delay / 1000);
        self.addTimeout(true);
        self.connect();
    }, delay);
}

SIOClient.prototype.setupKeepAlive = function () {
    clearTimeout(this.reconnectId);
    clearTimeout(this.timeoutId);

    var self = this;
    this.keepaliveTimer = setInterval(function () {
        self.checkKeepAlive();
    }, this.keepalive);
}

SIOClient.prototype.checkKeepAlive = function () {
    if (this.closed) {
        return;
    }

    var now = Date.now();
    var KEEP_ALIVE_TIMEOUT = this.keepalive * 2;
    if (this.lastPing > 0) {
        if (this.lastPong < this.lastPing) {
            if (now - this.lastPing > KEEP_ALIVE_TIMEOUT) {
                logger.error('sio rpc client checkKeepAlive error timeout for %d', KEEP_ALIVE_TIMEOUT);
                this.close();
            }
        } else {
            this.socket.pingreq();
            this.lastPing = Date.now();
        }
    } else {
        this.socket.pingreq();
        this.lastPing = Date.now();
    }
}

SIOClient.prototype.disconnect = function () {
    this.close();
}

SIOClient.prototype.close = function () {
    this.connected = false;
    this.closed = true;
    this.socket.disconnect();
}

SIOClient.prototype.exit = function () {
    process.exit(0);
}

module.exports = SIOClient;