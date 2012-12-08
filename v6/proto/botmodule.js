var events = require('events');

var BotModule = function (dependencies, requiredDependencies, moduleName) {
    if (dependencies === undefined || dependencies === null) {
	this.dependencies = {};
    }
    else {
	this.dependencies = dependencies;
    }
    if (typeof moduleName !== 'string') {
	moduleName = '';
    }

    var currentDepName, currentDep, errorString = '';
    for (var i in requiredDependencies) {
	currentDepName = requiredDependencies[i];
	currentDep = this.dependencies[currentDepName];
	if (currentDep === undefined || dependencies === null) {
	    errorString += 'Required dependency \''+currentDepName+
		'\' not provided to module '+moduleName+'\n';
	}
    }
    if (errorString !== '') {
	throw new Error(errorString);
    }
    this.requiredDependencies = requiredDependencies;
    console.log(requiredDependencies);
}
BotModule.prototype.__proto__ = events.prototype;

BotModule.prototype.addDependencies = function (dependencies) {
    if (dependencies) {
	for (i in dependencies) {
	    this.dependencies[i] = dependencies[i];
	}
    }
}

BotModule.prototype.getDependencies = function () {
    return this.dependencies;
}

BotModule.prototype.getRequiredDependencies = function () {
    return this.requiredDependencies;
}

module.exports = BotModule;