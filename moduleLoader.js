var moduleInfo = require('./moduleInfo.js')
var defaultInfo = require('./defaultInfo.js');

var ModuleLoader = function () {
    var __bot = null;
    var __didInit = false;
    var __modules = {};
    var __helpDictionary = {
	'commands': 'Type commands for a list of commands.',
	'help': 'Type help followed by a command for information '+
	    'on that command. Type commands for a list of commands.'
    };

    this.setBot = function (bot) {
	if (__didInit === true) {
	    console.log('WARNING: Bot cannot be swapped out after '+
			'initialization');
	    return;
	}
	else if (__didInit) {
	    throw new Error('Module loader has been corrupted.');
	}

	__bot = bot;
    }

    this.init = function () {
	if (__didInit === true) {
	    console.log('WARNING: Modules can only be initialized once');
	    return;
	}
	else if (__didInit) {
	    throw new Error('Module loader has been corrupted.');
	}
	__didInit = true;
	
	for (var name in moduleInfo) {
	    if (name === 'bot') {
		throw new Error('Module cannot be named \'bot\'.');
	    }
	    __modules[name] = require(moduleInfo[name]);
	    __modules[name] = new (__modules[name])();
	}
	for (var name in defaultInfo) {
	    if (name === 'bot') {
		throw new Error('Module cannot be named \'bot\'.');
	    }
	    if (__modules[name] === undefined || __modules[name] === null) {
		__modules[name] = require(defaultInfo[name]);
		__modules[name] = new (__modules[name])();
	    }
	}
	
	for (var name in __modules) {
	    __modules[name].install();
	}
    }

    this.mergeHelp = function (helpDictionary) {
	for (var word in helpDictionary) {
	    if (__helpDictionary[word]) {
		throw new Error('Duplicate help file entries for \''+word+
				'\' command');
	    }
	    __helpDictionary[word] = helpDictionary[word];
	}
    }
    this.getHelp = function () {
	return __helpDictionary;
    }

    this.getModule = function (moduleName) {
	if (moduleName === 'bot') {
	    return __bot;
	}	
	else {
	    return __modules[moduleName];
	}
    }

    this.getAllModules = function () {
	return __modules;
    }
}

ModuleLoader.instance = null;

ModuleLoader.getInstance = function (bot) {
    if (ModuleLoader.instance === null) {
	ModuleLoader.instance = new ModuleLoader();
    }
    return ModuleLoader.instance;
};

module.exports = ModuleLoader.getInstance();