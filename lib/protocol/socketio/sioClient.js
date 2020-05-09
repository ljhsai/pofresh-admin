const logger = require('pofresh-logger').getLogger('pofresh-admin', 'SIOClient');
const EventEmitter = require('events');
const constants = require('../../util/constants');
const IOClient = require('socket.io-client');

class SIOClient extends EventEmitter {
    constructor(opts) {
        super();
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

    connect(host, port, cb) {
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

        this.closed = false;

        this.socket = IOClient('http://' + host + ':' + port, {
            forceNew: true,
            reconnection: false,
            reconnectionDelay: this.reconnectDelay,
            reconnectionDelayMax: this.reconnectDelayMax,
            timeout: this.timeout
        });

        this.socket.on('register', (msg) => {
            this.emit('register', JSON.parse(msg));
        });

        this.socket.on('monitor', (msg) => {
            this.emit('monitor', JSON.parse(msg));
        });

        this.socket.on('client', (msg) => {
            this.emit('client', JSON.parse(msg));
        });

        this.socket.on('reconnect_ok', () => {
            this.emit('reconnect_ok');
        });

        this.socket.on('connect', () => {
            if (this.connected) {
                return;
            }
            this.connected = true;
            this.emit('connect');
            cb();
        });

        this.socket.on('reconnect', () => {
            this.emit('reconnect');
        });

        this.socket.on('error', (err) => {
            this.emit('error', new Error('[SIOClient] socket is error, remote server ' + host + ':' + port));
            this.onSocketClose();
        });

        this.socket.on('connect_error', (err) => {
            // logger.error('socket is error, remote server host: %s, port: %s', host, port);
            this.emit('error', new Error('[SIOClient] socket is connect error, remote server ' + host + ':' + port));
            this.onSocketClose();
        });

        this.socket.on('reconnect_error', (err) => {

        });

        this.socket.on('reconnect_failed', () => {
            this.emit('error', new Error('[SIOClient] socket reconnect_failed, remote server ' + host + ':' + port));
            this.onSocketClose();
        });

        this.socket.on('disconnect', () => {
            logger.error('socket is disconnect, remote server host: %s, port: %s', host, port);
            this.emit('disconnect', this.id);
            this.onSocketClose();
        });

        this.socket.on('connect_timeout', (timeout) => {
            logger.error('sio client connect %s:%d timeout %d s', this.host, this.port, this.timeout / 1000);
            this.emit('timeout', timeout);
        });
    }

    send(topic, msg) {
        this.socket.emit(topic, msg);
    }

    onSocketClose() {
        if (this.closed) {
            return;
        }

        this.connected = false;
        this.closed = true;
        delete this.socket;
        this.socket = null;
    }

    disconnect() {
        this.connected = false;
        this.closed = true;
        this.socket.close();
    }

    exit() {
        process.exit(0);
    }
}

module.exports = SIOClient;
