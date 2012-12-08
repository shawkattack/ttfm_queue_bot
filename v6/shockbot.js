var Bot = require('ttapi');

var ShockBot = function (configFile) {
    this.config = require(configFile);
    this.modules = {};

    var botAuth = this.config.botAuth;
    this.bot = new Bot(botAuth.auth, botAuth.userId, botAuth.roomId);

    var config = this.config;
    var modules = this.modules;
    for (var d in config.modules) {
	try {
	    modules[d] = require(config.modules[d].dflt);
            modules[d] = new (modules[d])({bot: this.bot});
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
}

module.exports = ShockBot;