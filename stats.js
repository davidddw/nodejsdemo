var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var flow = require('./flow.js');
var Vm =require('./vm.js');
var Vgateway =require('./vgateway.js');
var Epc = require('./epc.js');
var operationLog = require('./operation_log.js');

var Stats = function(){
    Obj.call(this);
};
util.inherits(Stats, Obj);
Stats.prototype.type = 'stats';
Stats.prototype.constructor = Stats;

Stats.prototype.logic_topo_get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    if (!('epc_id' in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: 'epc_id not specified'});
        return;
    }
    var filter = {};
    if ('interval' in data) {
        filter.interval = data.interval;
    }
    p.sendData('/v1/stats/logic-topologies/'+data.epc_id, 'get', filter, function(sCode, data){
        callback(data);
    }, function(a, b){errorcallback(a, b)});
}

Stats.prototype.vm_tx_get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var filter = {};
    if ('interval' in data) {
        filter.interval = data.interval;
    }
    if ('limit' in data) {
        filter.interval = data.limit;
    }
    p.sendData('/v1/stats/vm-tx-traffic-histories/'+data.lcuuid, 'get', filter, function(sCode, data){
        callback(data);
    }, function(a, b){errorcallback(a, b)});
}

module.exports=Stats;
