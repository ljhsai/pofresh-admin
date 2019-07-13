var logger = require('pofresh-logger').getLogger('pofresh-admin', 'SIOServer');
var EventEmitter = require('events').EventEmitter;
var SocketIO = require('socket.io');
var Util = require('util');

var curId = 1;

var SIOServer = function(opts, cb) {
	EventEmitter.call(this);
	this.inited = false;
	this.closed = true;
};

Util.inherits(SIOServer, EventEmitter);

SIOServer.prototype.listen = function(port) {
	//check status
	if (this.inited) {
		this.cb(new Error('already inited.'));
		return;
	}

	this.inited = true;

	var self = this;

	this.server = SocketIO();

	this.server.on('listening', this.emit.bind(this, 'listening'));

	this.server.on('error', function(err) {
		logger.error('sio server is error: %j', err.stack);
		self.emit('error', err);
	});

	this.server.on('connection', function(socket) {
		socket.id = curId++;

		socket.on('connect', function(pkg) {
			socket.connack({
				returnCode: 0
			});
		});

		socket.on('publish', function(pkg) {
			var topic = pkg.topic;
			var msg = pkg.payload.toString();
			msg = JSON.parse(msg);

			// logger.debug('[SIOServer] publish %s %j', topic, msg);
			socket.emit(topic, msg);
		});

		socket.on('pingreq', function() {
			socket.pingresp();
		});

		socket.send = function(topic, msg) {
			socket.publish({
				topic: topic,
				payload: JSON.stringify(msg)
			});
		};

		self.emit('connection', socket);
	});

	logger.info('[SIOServer] listen on %d', port);
	this.server.listen(port);
};

SIOServer.prototype.send = function(topic, msg) {
	this.socket.send({
		topic: topic,
		payload: msg
	});
}

SIOServer.prototype.close = function() {
	if (this.closed) {
		return;
	}

	this.closed = true;
	this.server.close();
	this.emit('closed');
};

module.exports = SIOServer;