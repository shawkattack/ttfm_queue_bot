var BotModule = require('./botmodule');
const moduleName = 'limit';

var LimitModule = function (depList) {
    BotModule.call(this,['bot'],moduleName);
    this.addDependencies(depList);

    this.setLimit = function (n) {
    }
    this.setLimit.override = true;

    this.clearLimit = function () {
    }
    this.setLimit.override = true;
}

module.exports = LimitModule;