var BotModule = require('./botmodule');
const moduleName = 'vips';

var VipsModule = function (depList) {
    BotModule.call(this,['bot'],moduleName);
    this.addDependencies(depList);

    this.setVipMode = function () {
    };
    this.setVipMode.override = true;

    this.unsetVipMode = function () {
    };
    this.unsetVipMode.override = true;

    this.addVip = function (id) {
	return false;
    };
    this.addVip.override = true;

    this.removeVip = function (id) {
	return false;
    };
    this.removeVip.override = true;
}

module.exports = VipsModule;