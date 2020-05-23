const logger = require('pofresh-logger').getLogger('pofresh-admin', 'test_module');

const DEFAULT_INTERVAL = 5; // in second
const DEFAULT_DELAY = 1; // in second

const moduleId = 'test_module';

module.exports = function (opts) {
    return new Module(opts);
};

module.exports.moduleId = moduleId;

class Module {
    constructor(opts) {
        opts = opts || {};
        this.type = opts.type || 'pull';
        this.interval = opts.interval || DEFAULT_INTERVAL;
        this.delay = opts.delay || DEFAULT_DELAY;
    }

    monitorHandler(agent, msg, cb) {
        console.log('monitorHandler %j', msg);
        // agent.notify(moduleId, {
        // 	serverId: agent.id,
        // 	body: {
        // 		hello: 'ok'
        // 	}
        // });
        cb(null, 'ok');
    }

    masterHandler(agent, msg, cb) {
        if (!msg) {
            // agent.notifyAll(moduleId);
            let sendMsg = {
                id: Date.now()
            };
            agent.request('test-server-1', moduleId, sendMsg, (err, r) => {
                if (err) {
                    console.error(err);
                }

                if (r) {
                    console.log(r);
                }
            });
            return;
        }
        console.log('masterHandler %j', msg);
    }

    clientHandler(agent, msg, cb) {
        console.log('clientHandler %j', msg);
    }
}
