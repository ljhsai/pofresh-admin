const logger = require('pofresh-logger').getLogger('pofresh-admin', 'MqttServer');
const EventEmitter = require('events').EventEmitter;
const MqttCon = require('mqtt-connection');
const net = require('net');

let curId = 1;

class MqttServer extends EventEmitter {
    constructor(opts, cb) {
        super();
        this.inited = false;
        this.closed = true;
    }

    listen(port) {
        //check status
        if (this.inited) {
            this.cb(new Error('already inited.'));
            return;
        }

        this.inited = true;

        this.server = new net.Server();
        this.server.listen(port);

        logger.info('[MqttServer] listen on %d', port);

        this.server.on('listening', this.emit.bind(this, 'listening'));

        this.server.on('error', (err) => {
            // logger.error('mqtt server is error: %j', err.stack);
            this.emit('error', err);
        });

        this.server.on('connection', (stream) => {
            let socket = MqttCon(stream);
            socket.id = curId++;

            socket.on('connect', (pkg) => {
                socket.connack({
                    returnCode: 0
                });
            });

            socket.on('publish', (pkg) => {
                let topic = pkg.topic;
                let msg = pkg.payload.toString();
                msg = JSON.parse(msg);

                // logger.debug('[MqttServer] publish %s %j', topic, msg);
                socket.emit(topic, msg);
            });

            socket.on('pingreq', () => {
                socket.pingresp();
            });

            socket.send = function (topic, msg) {
                socket.publish({
                    topic: topic,
                    payload: JSON.stringify(msg)
                });
            };

            this.emit('connection', socket);
        });
    }

    send(topic, msg) {
        this.socket.publish({
            topic: topic,
            payload: msg
        });
    }

    close() {
        if (this.closed) {
            return;
        }

        this.closed = true;
        this.server.close();
        this.emit('closed');
    }
}

module.exports = MqttServer;
