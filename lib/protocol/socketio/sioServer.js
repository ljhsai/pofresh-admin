var logger = require('pofresh-logger').getLogger('pofresh-admin', 'SIOServer');
var EventEmitter = require('events').EventEmitter;
var SocketIO = require('socket.io');
var Util = require('util');

var curId = 1;

var SIOServer = function (opts, cb) {
    EventEmitter.call(this);
    this.inited = false;
    this.closed = true;
};

Util.inherits(SIOServer, EventEmitter);

SIOServer.prototype.listen = function (port) {
    if (this.inited) {
        return this.cb(new Error('already inited.'));
    }

    this.inited = true;

    var self = this;

    this.server = SocketIO();

    this.server.on('connection', function (socket) {
        // socket.id = curId++;
        socket.send = function (topic, msg) {
            socket.emit(topic, JSON.stringify(msg));
        };
        self.emit('connection', socket);
    });

    logger.info('[SIOServer] listen on %d', port);
    this.emit('listening');
    this.server.listen(port);
    this.closed = false;
};

// SIOServer.prototype.send = function (topic, msg) {
//     this.socket.emit(topic, JSON.stringify(msg));
// }

SIOServer.prototype.close = function () {
    if (this.closed) {
        return;
    }
    this.closed = true;
    this.server.close();
    this.emit('closed');
};

module.exports = SIOServer;