const fs = require('fs');
const consoleService = require('./lib/consoleService');

module.exports.createMasterConsole = consoleService.createMasterConsole;
module.exports.createMonitorConsole = consoleService.createMonitorConsole;
module.exports.adminClient = require('./lib/client/client');

exports.protocols = {
    SIOServer: require('./lib/protocol/socketio/sioServer'),
    SIOClient: require('./lib/protocol/socketio/sioClient'),
}

exports.modules = {};

fs.readdirSync(__dirname + '/lib/modules').forEach(function (filename) {
    if (/\.js$/.test(filename)) {
        let name = filename.substr(0, filename.lastIndexOf('.'));
        let _module = require('./lib/modules/' + name);
        if (!_module.moduleError) {
            exports.modules.__defineGetter__(name, function () {
                return _module;
            });
        }
    }
});
