var events = require('events');
var depLoader = require('../moduleLoader.js');

// Create a closure so all of these locals are hidden but non-static.
var BotModule = function (depList, moduleName) {
    var __DepList = [];
    var __ModuleName = '';
    var __DepObject = {};
    
    // Error checking so as not to accidentally create a closure if something
    // is wrong. Memory leaks are a bitch.
    if (typeof moduleName !== 'string' || moduleName === '') {
	throw new Error('Attempting to create an improperly-named '+
			'BotModule');
    }
    try {
	if (depList !== undefined && depList !== null) {
	    __DepList = __DepList.concat(depList);
	}
    }
    catch (e) {
	throw new Error('Proper list of dependency names not provided '+
			'in module '+__ModuleName);
    }

    // Start creating functions for this "Object"

    // Gets the module name. Might be useful.
    this.getModuleName = function () {
	return __ModuleName;
    };

    // Validates all the dependencies and links them all together.
    // Catching any errors thrown by this is a terrible idea.
    this.install = function () {
	for (var x in __DepList) {
	    // Store a reference to the module locally
	    // If it doesn't exist, module loader will throw an error
	    __DepObject[x] = depLoader.getModule(x);
	}
    };

    // Add a list of dependencies (or a single one)
    this.addDependencies = function (depList) {
	try {
	    if (depList !== undefined && depList !== null) {
		__DepList = __DepList.concat(depList);
	    }
	}
	catch (e) {
	    throw new Error('Proper list of dependency names not provided '+
			    'in module '+__ModuleName);
	}
    };

    // Why not?
    this.getDependencyList = function () {
	return __DepList;
    }
};

module.exports = BotModule;