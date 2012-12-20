var moduleInfo = require('./moduleInfo.js')
var defaultInfo = require('./defaultInfo.js');

var ModuleLoader = function () {
    var __bot = null;
    var __didInit = false;
    var __modules = {};

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
	    }
	}
	
	for (var name in __modules) {
	    console.log(__modules[name].getDependencyList());
	    __modules[name].install();
	}
    }

    this.getModule = function (moduleName) {
	var tmp = __modules[moduleName];
	if (moduleName === 'bot') {
	    return __bot;
	}
	else if (tmp === undefined || tmp === null) {
	    throw new Error('Module '+moduleName+' not found.');
	}	
	else {
	    return __modules[moduleName];
	}
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