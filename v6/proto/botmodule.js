var EventEmitter = require('events').EventEmitter;

// Create a closure so all of these locals are hidden but non-static.
var BotModule = function (depList, moduleName) {
    var depLoader = require('../moduleLoader.js');
    var __depList = [];
    var __moduleName = '';
    var __depObject = {};
    
    // Allow for event throwing/handling
    EventEmitter.call(this);
    for (var i in EventEmitter.prototype) {
	this[i] = EventEmitter.prototype[i];
    }

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

	// Call any code that installs event handlers
	this.installHandlers();
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
    // Can be ignored most of the time, but warning is in place to remind
    this.installHandlers = function () {
    }
    this.installHandlers.override = true;
};
BotModule.prototype.__proto__ = EventEmitter.prototype;

module.exports = BotModule;