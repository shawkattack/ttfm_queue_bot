var Bot = require('ttapi');
var ModuleLoader = require('./moduleLoader.js');

var ShockBot = function (configFile) {
    // Initialize config and module data
    this.config = require(configFile);

    // Set up le bot
    var botAuth = this.config.botAuth;
    this.bot = new Bot(botAuth.auth, botAuth.userId, botAuth.roomId);

    var moduleLoader = ModuleLoader;
    moduleLoader.setBot(this.bot);
    moduleLoader.init();
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