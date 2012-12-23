var events = require('events');
var depLoader = require('../moduleLoader.js');

// Create a closure so all of these locals are hidden but non-static.
var BotModule = function (depList, moduleName) {
    var __depList = [];
    var __moduleName = '';
    var __depObject = {};
    
    // Error checking so as not to accidentally create a closure if something
    // is wrong. Memory leaks are a bitch.
    if (typeof moduleName !== 'string' || moduleName === '') {
	throw new Error('Attempting to create an improperly-named BotModule');
    }
    __moduleName = moduleName;

    try {
	if (depList !== undefined && depList !== null) {
	    __depList = __depList.concat(depList);
	}
    }
    catch (e) {
	throw new Error('Proper list of dependency names not provided '+
			'in module '+__moduleName);
    }

    // Start creating functions for this "Object"

    // Gets the module name. Might be useful.
    this.getModuleName = function () {
	return __moduleName;
    };

    // Validates all the dependencies and links them all together.
    // Catching any errors thrown by this is a terrible idea.
    this.install = function () {
	for (var x in __depList) {
	    // Store a reference to the module locally
	    var depName = __depList[x];
	    __depObject[depName] = depLoader.getModule(depName);
	}
	for (var x in this) {
	    if (this[x].override) {
		console.log('WARNING: Method '+x+' not overridden in '+
			    __moduleName+' module.');
	    }
	}

	// Detach module loader
	depLoader = null;

	// Call any initialization code
	this.init();
    };

    // Add a list of dependencies (or a single one)
    this.addDependencies = function (depList) {
	try {
	    if (depList !== undefined && depList !== null) {
		__depList = __depList.concat(depList);
	    }
	}
	catch (e) {
	    throw new Error('Proper list of dependency names not provided '+
			    'in module '+__moduleName);
	}
    };

    // Get an actual dependency, since we lock down the list
    this.getDep = this.getDependency = function (depName) {
	return __depObject[depName];
    }

    // Why not?
    this.getDependencyList = function () {
	return __depList;
    }

    // Override if any initialization must be done that relies on dependencies
    // Can be ignored most of the time
    this.init = function () {
    }
};

module.exports = BotModule;