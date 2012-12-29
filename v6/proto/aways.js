var BotModule = require('./botmodule');
const moduleName = 'aways';

var AwaysModule = function (depList) {
    BotModule.call(this,['bot'],moduleName);
    this.addDependencies(depList);

    // Does a user have a certain type of away?
    this.isAway = function (id, type) {
	return false;
    }
    this.isAway.override = true;

    // Get all the aways of a certain type
    this.getAways = function (type) {
	return {};
    }
    this.getAways.override = true;

    // Add an away of a certain type
    this.addAway = function (id, type) {
    }
    this.addAway.override = true;

    // Clear all aways for a user
    this.removeAways = function (id) {
    }
    this.removeAways.override = true;
}

module.exports = AwaysModule;