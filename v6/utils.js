var UtilsProto = require('./proto/utils.js');

var Utils = function (defaults) {
    this.prototype = new UtilsProto();
    this.addDependencies(defaults);
}

module.exports.UtilsModule = Utils;