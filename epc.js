var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var Instance = require('./instance.js');
var operationLog = require('./operation_log.js');
var flow = require('./flow.js');
var constr = require('./const.js');
var Domain = require('./domain.js')
var lc_utils = require('./lc_utils.js');

var Epc = function(){
    Obj.call(this);
    this.tableCols = [
        'name',
        'userid',
        'domain',
    ];
}

util.inherits(Epc, Obj);
Epc.prototype.state = {
};
Epc.prototype.tableName = 'epc_v2_2';
Epc.prototype.vm_table = 'fdb_vm_v2_2';
Epc.prototype.order_table = 'order_v2_2';
Epc.prototype.domain_table = 'domain_v2_2';
Epc.prototype.user_table = 'fdb_user_v2_2';
Epc.prototype.vgw_table = 'fdb_vgateway_v2_2';
Epc.prototype.vl2_table = 'fdb_vl2_v2_2';
Epc.prototype.hw_table = 'third_party_device_v2_2'
Epc.prototype.type = 'epc';
Epc.prototype.constructor = Epc;
var epc_table_name = 'epc_v2_2';

Epc.prototype.parseApiToBdbData = function(data){

}

Epc.prototype.get = function(data, callback, errorcallback){
    var p = this;

    var condition = 'select epc.id,epc.userid,epc.`name`,epc.operationid,epc.domain,epc.order_id,o.state as order_state,epc.mode from ?? epc left JOIN ?? o on epc.order_id = o.id where true';
    var param = [];
    var flow_steps = [];
    var epcs = [];
    var app = new flow.serial(flow_steps);

    if ('userid' in data) {
        condition += ' and ??=?';
        param.push('epc.userid');
        param.push(data.userid);
    }

    if ('name' in data) {
        condition += ' and ??=?';
        param.push('epc.name');
        param.push(data.name);
    }

    if ('id' in data) {
        condition += ' and ??=?';
        param.push('epc.id');
        param.push(data.id);
    }

    if ('domain' in data) {
        condition += ' and ??=?';
        param.push('epc.domain');
        param.push(data.domain);
    }

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            [Epc.prototype.tableName,Epc.prototype.order_table].concat(param),
            function(ans){
                if (ans.length > 0) {
                    epcs = lc_utils.upperJsonKey(ans);
                }
                f(epcs);
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    flow_steps.push(function(a, f){
        var rdata = {};

        rdata.OPT_STATUS = 'SUCCESS';
        rdata.DESCRIPTION = '';
        rdata.TYPE = 'EPC';

        if (epcs.length == 0){
            if ('id' in data){
                errorcallback(404);
            }
            else{
                rdata.DATA = [];
                callback(rdata);
            }
        }
        else{
            if ('id' in data){
                rdata.DATA = epcs[0];
            }
            else{
                rdata.DATA = epcs;
            }
            callback(rdata);
        }
    });
    app.fire('', function(){});
}

Epc.prototype.create = function(data, callback, errorcallback){
    var p = this;
    var condition = 'select * from ?? where true and ??=? and ??=? ';
    var condition_insert = "insert into ?? (userid,name,domain,order_id,mode) select ?,CONCAT(name,'-',username),lcuuid,?,? from ?? , ?? ?? where ??=? and ??=? ";
    var param = [p.tableName];
    var order_id = 0;
    if('order_id' in data){
        order_id = data.order_id;
    }
    if(data.name != ''){
        condition += ' and ??=?';
        param.push('name');
        param.push(data.name);
        condition_insert = condition_insert.replace("CONCAT(name,'-',username)", "'"+data.name+"'");
    }
    param.push('userid');
    param.push(data.userid);
    param.push('domain');
    param.push(data.domain);

    var param_insert = [p.tableName];
        param_insert.push(data.userid);
        param_insert.push(order_id);
        param_insert.push(data.mode||2);
        param_insert.push(p.domain_table);
        param_insert.push(p.user_table);
        param_insert.push('user');
        param_insert.push('user.id');
        param_insert.push(data.userid);
        param_insert.push('lcuuid');
        param_insert.push(data.domain);

    p.executeSql(condition)(param,function(select_rdata){
        if (select_rdata.length == 0) {
            p.executeSql(condition_insert)(param_insert, function(rdata){
                callback({OPT_STATUS: "SUCCESS",DATA: { ID: rdata.insertId, NAME: data.name, USERID: data.userid }});
                operationLog.create_and_update({operation:'create', objecttype:'epc', objectid:rdata.insertId,
                object_userid:data.userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
            },errorcallback);
        } else{
            errorcallback(400, {OPT_STATUS: constr.OPT.EPC_ALREADY_EXIST,DESCRIPTION: 'Already has epc with this name'});
        }
    },function(a){errorcallback(a);});
}

Epc.prototype.update = function(data, callback, errorcallback){
    var p = this;
    var name ;
    if(!('id' in data) || !('userid' in data) || !('name' in data)){
        callback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL });
    }
    var condition = 'select * from ?? where true and name=? and userid=? ';
    var param = [Epc.prototype.tableName];

    param.push(data.name);
    param.push(data.userid);

    p.executeSql(condition)(param, function(epc_rdata){
        if (epc_rdata && epc_rdata.length > 0){
            logger.info('Already has epc with this name');
            errorcallback(500, {OPT_STATUS:constr.OPT.EPC_ALREADY_EXIST, DESCRIPTION:"Already has epc with this name"});
        }else {
            p.updateSql([p.tableName, {name:data.name}, 'id', data.id],function(ans){callback({id:data.id, OPT_STATUS:"SUCCESS"});},errorcallback)
        }
    },function(a){errorcallback(a);});
}

Epc.prototype.delete = function(data, callback, errorcallback){
    var p = this;
    p.selectSql(
        [p.tableName, 'id', data.id], function(rdata){
            if (rdata.length){
                p.selectSql([p.vm_table, 'epc_id', rdata[0].id], function(vm_rdata){
                    if (vm_rdata.length){
                        logger.error('cannot delete epc, vm exist');
                        errorcallback(500, {OPT_STATUS:constr.OPT.EPC_NOT_EMPTY, DESCRIPTION:"cannot delete epc, vm exist"});
                    }
                    else {
                        p.selectSql([p.vgw_table, 'epc_id', rdata[0].id], function(vgw_rdata){
                            if (vgw_rdata.length){
                                logger.error('cannot delete epc, vgw exist');
                                errorcallback(500, {OPT_STATUS:constr.OPT.EPC_NOT_EMPTY, DESCRIPTION:"cannot delete epc, vgw exist"});
                            }
                            else {
                                p.selectSql([p.vl2_table, 'epc_id', rdata[0].id], function(vl2_rdata){
                                    if (vl2_rdata.length){
                                        logger.error('cannot delete epc, vl2 exist');
                                        errorcallback(500, {OPT_STATUS:constr.OPT.EPC_NOT_EMPTY, DESCRIPTION:"cannot delete epc, vl2 exist"});
                                    }
                                    else {
                                        p.selectSql([p.hw_table, 'epc_id', rdata[0].id], function(hwData){
                                            if (hwData.length){
                                                logger.error('cannot delete epc, hw exist');
                                                errorcallback(500, {OPT_STATUS:constr.OPT.EPC_NOT_EMPTY, DESCRIPTION:"cannot delete epc, hw exist"});
                                            } else {
                                                 p.deleteSql([p.tableName, 'id', data.id], function(){}, function(){});
                                                 operationLog.create_and_update({operation:'delete', objecttype:'epc', objectid:data.id,
                                                     object_userid:rdata[0].userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                                                 callback({id:data.id, OPT_STATUS:"SUCCESS"});
                                            }
                                        })
                                    }
                                },function(){});
                            }
                        },function(){});
                    }
                }, function(){});
            }
            else{
                errorcallback(404, {OPT_STATUS:constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION:"epc not found"});
            }
            },
            errorcallback
    )
}

Epc.prototype.fill_epc_for_bdb_instance = function(p, app, errorcallback) {
    app.list.push(function(bdb_instances, f) {
        var epc_condition = 'SELECT * FROM ?? WHERE id IN (-1';
        var instances_epcids = [];
        var i, j;
        for (i = 0; i < bdb_instances.length; ++i) {
            if (!bdb_instances[i].EPC_ID) {
                continue;
            }
            for (j = 0; j < instances_epcids.length; ++j) {
                if (instances_epcids[j] == bdb_instances[i].EPC_ID) {
                    break;
                }
            }
            if (j >= instances_epcids.length) {
                instances_epcids.push(bdb_instances[i].EPC_ID);
                epc_condition += ',' + instances_epcids[j];
            }
        }
        epc_condition += ')'

        p.executeSql(epc_condition)(
            [epc_table_name],
            function(ans){
                var i, j;
                var users = [];
                for (i = 0; i < ans.length; ++i) {
                    users.push({
                        ID: ans[i].id,
                        EPCNAME: ans[i].name
                    });
                }
                for (i = 0; i < bdb_instances.length; i++) {
                    bdb_instances[i].EPC = null;
                    for (j = 0; j < users.length; ++j) {
                        if (bdb_instances[i].EPC_ID == users[j].ID) {
                            bdb_instances[i].EPC = users[j];
                            break;
                        }
                    }
                }
                f(bdb_instances);
            },
            function(a){
                errorcallback(a, {
                    'OPT_STATUS': constr.OPT.SERVER_ERROR,
                    'DESCRIPTION': 'Exec sql error, select from fdb_user failed.'
                });
                app.STD_END();
            }
        );
    });
}

module.exports = Epc;
