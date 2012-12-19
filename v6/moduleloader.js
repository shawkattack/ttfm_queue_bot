var moduleInfo = require('./moduleInfo.js')
var defaultInfo = require('./defaultInfo.js');

var ModuleLoader = function () {
    var modules = {};

    for (var name in moduleInfo) {
	modules[name] = require(moduleInfo[name])();
    }
    for (var name in defaultInfo) {
	if (modules[name] === undefined || modules[name] === null) {
	    modules[name] = require(defaultInfo[name]);
	}
    }

    this.getModule = function (moduleName) {
	var tmp = modules[moduleName];
	if (tmp === undefined || tmp === null) {
	    throw new Error('');
	}
	else {
	    return modules[moduleName];
	}
    }
}

ModuleLoader.instance = null;

ModuleLoader.getInstance = function () {
    if (this.instance === null) {
	this.instance = new ModuleLoader();
    }
    return this.instance;
};

module.exports = ModuleLoader.getInstance();