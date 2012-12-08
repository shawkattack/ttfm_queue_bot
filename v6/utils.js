var UtilsModule = require('./proto/utils.js');

var Utils = function () {
    var dependencies = arguments[0];
    this.dependencies = dependencies;
    this.requiredDependencies = [];
};
Utils.prototype = new UtilsModule(Utils.prototype.dependencies,
				  Utils.prototype.requiredDependencies);

module.exports = Utils;