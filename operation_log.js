var logger = require('./logger.js');
var Obj = require('./obj.js');
var util = require('util');
var constr = require('./const.js');

var OperationLog = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'operation',
        'objecttype',
        'objectid',
        'object_userid',
        'start_time',
        'end_time',
        'operator_name',
        'opt_result',
        'error_code',
        'comment',
        'name',
    ];
}
util.inherits(OperationLog, Obj);

OperationLog.prototype.tableName = 'operation_log_v2_2';
OperationLog.prototype.type = 'operation_log';
OperationLog.prototype.constructor = OperationLog;

OperationLog.prototype.parseInputToDbData = function(data){
    var ans = {};
    var cols = this.tableCols, key='';
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[cols[i]] = data[key];
        } else if(cols[i] in data){
            ans[cols[i]] = data[cols[i]]
        }
    }

    return ans;
}

OperationLog.prototype.create_and_update = function(data, callback, errorcallback){
    logger.debug('creating and updating operation log ');
    var p = this;
    var dbdata = p.parseInputToDbData(data);
    dbdata.start_time = new Date().toMysqlFormat();
    dbdata.end_time = dbdata.start_time;
    var table_name = p.getTableName(dbdata.objecttype)
    var column, value;
    if (dbdata.comment != '' && dbdata.comment != null && dbdata.comment != undefined){
        p.insertSql(
            [p.tableName, dbdata],
            function(rdata){
            callback({id:rdata.insertId, OPT_STATUS:"SUCCESS"});
            },
            errorcallback);
    } else if (dbdata.name != '' && dbdata.name != null && dbdata.name != undefined) {
        p.insertSql(
            [p.tableName, dbdata],
            function(rdata){
                callback({id:rdata.insertId, OPT_STATUS:"SUCCESS"});
            },
            errorcallback);
    } else if ((dbdata.objectid == null || dbdata.objectid == undefined || dbdata.objectid == '') || table_name == '' ){
        logger.error('objectid or table_name is null ');
        errorcallback(400);
    } else {
        if('lcuuid' in dbdata){
            column = 'lcuuid';
            value = dbdata.lcuuid;
        } else {
            column = 'id';
            value = dbdata.objectid;
        }
        p.selectSql(
            [table_name, column, value],
            function(rdata){
                if (rdata.length){
                    if (dbdata.objecttype == "isp_ip_resource"){
                        dbdata.objecttype = 'ISP IP';
                        dbdata.name = rdata[0].ip;
                    } else if (dbdata.objecttype == "user_order_isp_bandwidth") {
                        dbdata.objecttype = 'ISP Bandwidth';
                        dbdata.name = Math.abs(rdata[0].bandwidth >> 20) + 'M';
                    } else{
                        dbdata.name = rdata[0].name;
                    }
                    dbdata.comment = p.generate_comment(dbdata.objecttype, dbdata.name, dbdata.operation);
                    p.insertSql(
                        [p.tableName, dbdata],
                        function(rdata){
                        callback({id:rdata.insertId, OPT_STATUS:"SUCCESS"});
                        },
                        errorcallback);
                } else{
                    logger.error('get object name from db fail ');
                    errorcallback(404)
                }
            }, function(){ });
    }
}

OperationLog.prototype.create = function(data){
    logger.debug('creating operation log ');
    var p = this;
    var dbdata = p.parseInputToDbData(data);
    var datatype = dbdata.objecttype;
    dbdata.start_time = new Date().toMysqlFormat();
    var tableName = p.getTableName(dbdata.objecttype);
    if ((dbdata.objectid == null || dbdata.objectid == undefined || dbdata.objectid == '') || tableName == '' ){
        logger.error('objectid or table_name is null ');
        errorcallback(400);
    }
    else {
        p.selectSql(
            [tableName, 'id', dbdata.objectid],
            function(rdata){
                if (rdata.length){
                    if (dbdata.objecttype == "isp_ip_resource"){
                        dbdata.objecttype = 'ISP IP';
                        dbdata.name = rdata[0].ip;
                    } else if (dbdata.objecttype == "user_order_isp_bandwidth") {
                        dbdata.objecttype = 'ISP Bandwidth';
                        dbdata.name = Math.abs(rdata[0].bandwidth >> 20) + 'M';
                    } else{
                        dbdata.name = rdata[0].name;
                    }
                    dbdata.comment = p.generate_comment(dbdata.objecttype, dbdata.name, dbdata.operation);
                    p.insertSql(
                        [p.tableName, dbdata],
                        function(){
                            p.selectSql(
                            [p.tableName, 'objecttype', dbdata.objecttype],
                            function(rdata){
                                if (rdata.length){
                                    var operationid = rdata[rdata.length-1].id;
                                    p.updateSql([tableName, {operationid:operationid}, 'id', dbdata.objectid],
                                    function(){ }, function(){ });
                                } else{
                                    logger.error('get logid from db fail ');
                                }
                            }, function(){ });
                        }, function(){ });
                }
            }, function(){});
    }
}

OperationLog.prototype.update = function(data, callback){
    logger.debug('updating operation log ');
    var p = this;
    var dbdata = p.parseInputToDbData(data);
    var tableName = p.getTableName(dbdata.objecttype);
    logger.debug('update log type = '+dbdata.objecttype+' db = ' + tableName);
    p.selectSql(
        [tableName, 'id', dbdata.objectid],
        function(rdata){
            if (rdata.length){
                var operationid = rdata[0].operationid;
                var current_time = new Date().toMysqlFormat();
                p.updateSql([p.tableName, {end_time:current_time, opt_result:dbdata.opt_result, error_code:dbdata.error_code},
                    'id', operationid],
                    function(){callback&&callback()}, function(){ });
            } else{
                logger.error('update operation log fail ');
            }
        }, function(){ });
}

OperationLog.prototype.getTableName = function(type){
    switch(type){
        case 'vm':
             return "fdb_vm_v2_2";
        case 'vgw':
             return "fdb_vgw_v2_2";
        case 'vl2':
        case 'isp':
             return "fdb_vl2_v2_2";
        case 'vgateway':
             return "fdb_vgateway_v2_2";
        case 'valve':
             return "fdb_vgateway_v2_2";
        case 'thirdhw':
             return "third_party_device_v2_2";
        case 'isp_ip_resource':
             return "ip_resource_v2_2";
        case 'user_order_isp_bandwidth':
             return "user_order_isp_bandwidth_v2_2";
        case 'epc':
             return "epc_v2_2";
        case 'user':
             return "fdb_user_v2_2";
        case 'nas':
            return "nas_storage_v2_2";
        case 'cloud_disk':
            return "cloud_disk_v2_2";
        case 'lb':
            return "fdb_vm_v2_2";
        case 'lb_forward_rule':
            return "lb_forward_rule_v2_2";
        case 'vfw':
            return "fdb_vm_v2_2";
        case 'backupspace':
            return "backup_space_v2_2";
        default :
             return "";
    }
}

OperationLog.prototype.generate_comment = function(objtype, name, operation){
    return constr.OBJ_TYPE_ARRAY[objtype] + name + constr.OPERATION_ARRAY[operation];
}

module.exports = new OperationLog();
