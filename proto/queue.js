var BotModule = require('./botmodule');
const moduleName = 'queue';

var QueueModule = function (depList) {
    BotModule.call(this,['bot'],moduleName);
    this.addDependencies(depList);
    
    // Gets position of a user in the queue
    this.getQueuePosition = function (id) {
	return 0;
    };
    this.getQueuePosition.override = true;

    // Gets position of a user in the queue IGNORING users in ignoreList
    // The format of ignoreList has been left implementation-dependent
    // Feel free to do this however you want. Override not required.
    this.getRealQueuePosition = function (id, ignoreList) {
	return 0;
    };

    // Calls the next person on the queue
    this.callNext = function () {
    };
    this.callNext.override = true;

    // Adds a user to the end of the queue
    this.enqueue = function (id, name) {
    };
    this.enqueue.override = true;

    // Removes a user from the queue
    this.dequeue = function (id) {
    };
    this.dequeue.override = true;

    // Move a user in the queue
    this.moveInQueue = function (id, amount) {
    };
    this.moveInQueue.override = true;

    // Prints out the queue
    // Override recommended, not required
    this.printQueue = function () {
    };

    // Prints the spot of a user in the queue
    // Override not required
    this.printSpot = function (id) {
    };

    // Gets the length of the current queue
    this.getQueueSize = function () {
	return 0;
    };
    this.getQueueSize.override = true;
};

module.exports = QueueModule;