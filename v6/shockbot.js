var Bot = require('ttapi');
var defaults = require('./defaults.js');

var ShockBot = function (configFile) {
    // Initialize config and module data
    this.config = require(configFile);
    this.modules = {};

    // Set up le bot
    var botAuth = this.config.botAuth;
    this.bot = new Bot(botAuth.auth, botAuth.userId, botAuth.roomId);

    // Make shortcuts and load in default dependencies
    var config = this.config;
    var modules = this.modules;
    for (var d in defaults) {
	try {
	    defaults[d] = require(defaults[d]);
            modules[d] = new (defaults[d])({});
	    console.log('[O] Loaded default module '+d);
	}
	catch (e) {
	    console.log('[X] Failed to load module '+d);
	}
    }
/* Use this later
    for (var f in modules[d]) {
	if (modules[d][f].override) {
	    console.log(' -    Warning: Using stub for function \''+
			f+'\' - Consider overriding.');
	}
    }
*/
    modules.utils = require(config.modules.utils);
    modules.utils = new (modules.utils)({});
    console.log(modules.utils.getRequiredDependencies());
}

module.exports = ShockBot;