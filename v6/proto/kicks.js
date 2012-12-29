var BotModule = require('./botmodule');
const moduleName = 'kicks';

var KicksModule = function (depList) {
    BotModule.call(this,['bot'],moduleName);
    this.addDependencies(depList);

    this.addKick = function (id, options) {
    }
    this.addKick.override = true;

    this.removeKick = function (id) {
    }
    this.removeKick.override = true;

    this.getKicks = function (options) {
	return {};
    }
    this.getKicks.override = true;
}

module.exports = KicksModule;