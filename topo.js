var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var flow = require('./flow.js');
var Vm =require('./vm.js');
var ThirdHW =require('./third_party_device.js');
var Vgateway =require('./vgateway.js');
var Epc = require('./epc.js');
var operationLog = require('./operation_log.js');

var Topo = function(){
    Obj.call(this);
};
util.inherits(Topo, Obj);
Topo.prototype.type = 'topologies';
Topo.prototype.constructor = Topo;

function splice_data(vms, vgateways, thirdHWs, res_data) {
    var i, j;
    var filter;
    for (i = res_data.length - 1; i >= 0; --i) {
        if (res_data[i].INSTANCE_TYPE == 'VM') {
            filter = vms;
        } else if (res_data[i].INSTANCE_TYPE == 'VGATEWAY') {
            filter = vgateways;
        } else if (res_data[i].INSTANCE_TYPE == 'THIRDHW') {
            filter = thirdHWs;
        } else {
            res_data.splice(i, 1);
            continue;
        }

        for (j = 0; j < filter.length; j++) {
            if (filter[j].lcuuid == res_data[i].INSTANCE_LCUUID) {
                res_data[i].INSTANCE_ID = filter[j].id;
                break;
            }
        }
    }
}

function generalHandle(p, data, callback, errorcallback) {
    return function(a, f){
        p.sendData('/v1/topologies/'+data['epc_id'], 'get', {}, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                splice_data(data['vms'], data['vgateways'], data['thirdHWs'], rdata.DATA.INTERFACES);
            }
            callback(rdata);
            f(a);},
            errorcallback
        );
    }
}

function smartHandle(p, data, callback, errorcallback) {
    return function(a, f){
        p.sendData('/v1/topologies/'+data['epc_id'], 'get', {'smart':'true'}, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                var i, j, nets, infs;
                splice_data(data['vms'], data['vgateways'], data['thirdHWs'], rdata.DATA.ISOLATE_INTERFACES);
                splice_data(data['vms'], data['vgateways'], data['thirdHWs'], rdata.DATA.SERVICE_NETWORK.INTERFACES);
                tiers = rdata.DATA.TIERS;
                for (i = tiers.length - 1; i >= 0; --i) {
                    nets = tiers[i].NETWORKS;
                    for (j = nets.length - 1; j >= 0; --j) {
                        infs = nets[j].INTERFACES;
                        splice_data(data['vms'], data['vgateways'], data['thirdHWs'], infs);
                    }
                }
            }
            callback(rdata);
            f(a);},
            errorcallback
        );
    }
}

Topo.prototype.get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var flow_steps = [];
    var app = new flow.parallel(flow_steps);

    flow_steps.push(function(a, f){
        f('epc_id', data.epc_id);
    })

    flow_steps.push(function(a, f){
        p.selectSql(
            [Vm.prototype.tableName, 'epc_id', data.epc_id],
            function(ans){
                f('vms', ans);
            },
            function(a){f('vms', []), errorcallback(a)}
        );
    });

    flow_steps.push(function(a, f){
        p.selectSql(
            [Vgateway.prototype.tableName, 'epc_id', data.epc_id],
            function(ans){
                f('vgateways', ans);
            },
            function(a){f('vgateways', []), errorcallback(a)}
        );
    });

    flow_steps.push(function(a, f){
        p.selectSql(
            [ThirdHW.prototype.tableName, 'epc_id', data.epc_id],
            function(ans){
                f('thirdHWs', ans);
            },
            function(a){f('thirdHWs', []), errorcallback(a)}
        );
    });

    if ('smart' in data && data.smart == 'true') {
        app.fire_with_dict_data(
            '',
            function(a){
                return smartHandle(p, a, callback, errorcallback)('', function(){})
            }
        );
    } else {
        app.fire_with_dict_data(
            '',
            function(a){
                return generalHandle(p, a, callback, errorcallback)('', function(){})
            }
        );
    }
}

module.exports=Topo;
