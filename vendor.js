var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var uuid = require('node-uuid');

var Vendor = function() {
    Obj.call(this);
}

util.inherits(Vendor, Obj);

Vendor.prototype.get = function(data, callback, errorcallback) {
     var p = this;
     var filter = {};
     var vendor = '';
     var service_type = '';
     if ('lcuuid' in data) {
         vendor = '/' + data.lcuuid;
     }
     if ('service-type' in data) {
         filter['service-type'] = data['service-type'];
     }
     p.sendData('/v1/service-vendors' + vendor , 'get', filter,
         function(sCode, rdata) {callback(rdata);
     }, errorcallback);
}

module.exports = Vendor;