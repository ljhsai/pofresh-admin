const logger = require('pofresh-logger').getLogger('pofresh-admin', 'SIOServer');
const EventEmitter = require('events');
const SocketIO = require('socket.io');

let curId = 1;

class SIOServer extends EventEmitter {
    constructor(opts, cb) {
        super();
        this.inited = false;
        this.closed = true;
    }

    listen(port) {
        if (this.inited) {
            return this.cb(new Error('already inited.'));
        }

        this.inited = true;

        this.server = SocketIO();

        this.server.on('connection', (socket) => {
            // socket.id = curId++;
            socket.send = function (topic, msg) {
                socket.emit(topic, JSON.stringify(msg));
            };
            this.emit('connection', socket);
        });

        logger.info('[SIOServer] listen on %d', port);
        this.emit('listening');
        this.server.listen(port);
        this.closed = false;
    }

// send = function (topic, msg) {
//     this.socket.emit(topic, JSON.stringify(msg));
// }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.server.close();
        this.emit('closed');
    }
}

module.exports = SIOServer;
