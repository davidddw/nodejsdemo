var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var Vl2 = require('./vl2.js');
var Vdc = require('./vdc.js');
var Vpc = require('./vpc.js');
var Epc = require('./epc.js');
var Isp = require('./isp.js');
var user = require('./user.js');
var lc_utils = require('./lc_utils.js');
var operationLog = require('./operation_log.js');
var constr = require('./const.js');
var Cashier = require('./cashier.js');
var atry = require('./mydomain.js');
var Domain = require('./domain.js');
var balance = require('./balance.js');
var LB = require('./lb.js');
var ms = require('./ms.js');

var Vm = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'os',
        'name',
        'state',
        'errno',
        'flag',
        'description',
        'ip',
        'netmask',
        'gateway',
        'vcpu_num',
        'mem_size',
        'sys_disk_size',
        'user_disk_size',
        'os',
        'launch_server',
        'pool_lcuuid',
        'vcloudid',
        'vnetid',
        'vl2id',
        'userid',
        'order_id',
        'epc_id',
        'expired_time',
        'create_time',
        'snapshotstate',
        'is_expired',
        'lcuuid',
        'product_specification_lcuuid',
        'operationid',
        'role',
        'domain',
    ];
}
util.inherits(Vm, Obj);
Vm.prototype.state = {
        TEMP : 0,
        CREATING : 1,
        CREATED : 2,
        STARTING : 3,
        RUNNING : 4,
        STOPPING : 8,
        STOP : 9,
        MODIFYING : 10,
        EXCEPTION : 11,
        DELETING : 12,
        DELETED : 13,
        SNAPSHOT_TO_CREATE : 1,
        SNAPSHOT_CREATED : 2,
        SNAPSHOT_TO_DELETE : 3,
        SNAPSHOT_DELETED : 4,
        SNAPSHOT_TO_RECOVER : 5,
        SNAPSHOT_ABNORMAL : 6
};

Vm.prototype.getActionStatus = function(cur){
    if (this.action == 'create' || this.action == 'recreate'){
        if (cur.state != this.state.TEMP){
            return 'done';
        } else{
            return 'failed';
        }
    }
    else if (this.action == 'start'){
        if (cur.state == this.state.RUNNING){
            return 'done';
        } else{
            return 'failed';
        }
    }
    else if (this.action == 'stop'){
        if (cur.state == this.state.STOP){
            return 'done';
        } else{
            return 'failed';
        }
    }
    else if (this.action == 'delete'){
        if (cur.state == this.state.DELETED){
            return 'done';
        } else{
            return 'failed';
        }
    } else if (this.action == 'snapshot'){
        if (cur.snapshotstate == this.state.SNAPSHOT_CREATED){
            return 'done';
        } else{
            return 'failed';
        }
    } else if (this.action == 'delsnapshot'){
        if (cur.snapshotstate == this.state.SNAPSHOT_DELETED){
            return 'done';
        } else{
            return 'failed';
        }
    } else if (this.action == 'recoversnapshot'){
        if (cur.snapshotstate == this.state.SNAPSHOT_CREATED){
            return 'done';
        } else{
            return 'failed';
        }
    }
    else if (this.action == 'modify'){
        return 'done';
    }
    else if (this.action == 'modifyvdisk'){
        return 'done';
    }
    else if (this.action == 'delvdisk'){
        return 'done';
    } else{
        return 'dontknow';
    }
}
Vm.prototype.flag = {
    ISOLATED : 0x4,
}
Vm.prototype.type = 'vm';
Vm.prototype.tableName = 'fdb_vm_v2_2';
Vm.prototype.user_tableName = 'fdb_user_v2_2';
Vm.prototype.snapshot_tableName = 'vm_snapshot_v2_2';
Vm.prototype.iptableName = 'ip_resource_v2_2';
Vm.prototype.bwtableName = 'user_isp_bandwidth_v2_2';
Vm.prototype.viftableName = 'vinterface_v2_2';
Vm.prototype.product_spec_tableName = 'product_specification_v2_2';
Vm.prototype.pool_product_spec_tableName = 'pool_product_specification_v2_2';
Vm.prototype.vul_scanner_tableName = 'vul_scanner_v2_2';
Vm.prototype.snapshot_product_type = 11;
Vm.prototype.viftype = 1;
Vm.prototype.constructor = Vm;
Vm.prototype.requiredApiData = {
    ALLOCATION_TYPE: 'allocation_type',
    ALLOC_POOLS: 'alloc_pools',
    USERID: 'userid',
    NAME: 'name',
    OS: 'os',
    POOLID: 'poolid',
    LAUNCH_SERVER: 'launch_server',
    VCPU_NUM: 'vcpu_num',
    MEM_SIZE: 'mem_size',
    SYS_DISK_SIZE: 'sys_disk_size',
    USER_DISK_SIZE: 'user_disk_size',
    PRODUCT_SPECIFICATION_LCUUID: 'product_specification_lcuuid',
    ROLE: 'role'
};

Vm.prototype.checkApiCreateData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.NAME in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_ALREADY_EXIST,DESCRIPTION: 'Resource already exist'});
        return false;
    }
    if (!(required.USERID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'userid is not specified'});
        return false;
    }
    if (!(required.OS in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'os is not specified'});
        return false;
    }
    if (!(required.ALLOCATION_TYPE in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'allocation_type is not specified'});
        return false;
    }
    if (!(required.ROLE in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'role is not specified'});
        return false;
    }
    if (data.allocation_type == 'manual') {
        if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'product_specification is not specified'});
            return false;
        }
        if (!(required.VCPU_NUM in data)) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'vcpu_num is not specified'});
            return false;
        }
        if (!(required.MEM_SIZE in data)) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'mem_size is not specified'});
            return false;
        }
        if (!(required.SYS_DISK_SIZE in data)) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'sys_disk_size is not specified'});
            return false;
        }
        if (!(required.USER_DISK_SIZE in data)) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'user_disk_size is not specified'});
            return false;
        }
        if (!(required.POOLID) in data) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'poolid is not specified'});
            return false;
        }
        if (!(required.LAUNCH_SERVER in data)) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'launch_server is not specified'});
            return false;
        }
    } else if (data.allocation_type == 'auto') {
        if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
            if (!(required.ALLOC_POOLS in data)) {
                errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'alloc_pools is not specified'});
                return false;
            }
            if (!(required.VCPU_NUM in data)) {
                errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'vcpu_num is not specified'});
                return false;
            }
            if (!(required.MEM_SIZE in data)) {
                errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'mem_size is not specified'});
                return false;
            }
            if (!(required.SYS_DISK_SIZE in data)) {
                errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'sys_disk_size is not specified'});
                return false;
            }
            if (!(required.USER_DISK_SIZE in data)) {
                errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'user_disk_size is not specified'});
                return false;
            }
        }
    }
    return true;
}

Vm.prototype.checkVMName = function(data,callback , errorcallback) {
    var p = this;
    p.selectSql([Vm.prototype.tableName, 'name', data.name],
        function(data){
            if (data.length > 0){
                callback(true);
            } else{
                callback(false);
            }
        },
        function(a){errorcallback(a);}
    )
}

Vm.prototype.checkVMState = function(data,callback , errorcallback) {
    var condition = "select id from ?? where id='"+data.id+"' and state ='"+this.state.RUNNING+"'";
    var p = this;
    p.executeSql(condition)([Vm.prototype.tableName],
        function(ans){
            if (ans.length > 0){
                callback(true);
            } else{
                callback(false);
            }
        },
        function(a){errorcallback(a);}
    )
}

Vm.prototype.parseApiToBdbData = function(data, callback, errorcallback, flag){
    var ans = {};
    var cols = this.tableCols, key='';
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[key] = data[key];
        } else if (cols[i] in data){
            ans[key] = data[cols[i]]
        }
    }
    if ('ID' in ans){
        delete(ans['ID']);
    }
    if ('LCUUID' in ans) {
        delete(ans['LCUUID']);
    }
    if ('SYS_DISK_SIZE' in ans){
        ans['VDI_SYS_SIZE'] = ans.SYS_DISK_SIZE;
        delete(ans['SYS_DISK_SIZE']);
    }
    if ('USER_DISK_SIZE' in ans){
        ans['VDI_USER_SIZE'] = ans.USER_DISK_SIZE;
        delete(ans['USER_DISK_SIZE']);
    }
    if ('IP' in ans){
        if ('VIF' in ans){
            ans.VIF.IP = ans.IP;
        } else{
            ans.VIF = {IP : ans.IP};
        }
        delete(ans['IP']);
    }
    if ('NETMASK' in ans){
        if ('VIF' in ans){
            ans.VIF.NETMASK = ans.NETMASK;
        } else{
            ans.VIF = {NETMASK : ans.NETMASK};
        }
        delete(ans['NETMASK']);
    }
    if ('GATEWAY' in ans){
        if ('VIF' in ans){
            ans.VIF.GATEWAY = ans.GATEWAY;
        } else{
            ans.VIF = {GATEWAY : ans.GATEWAY};
        }
        delete(ans['GATEWAY']);
    }
    if ('ORDER_ID' in ans){
        delete(ans['ORDER_ID']);
    }
    if ('STATE' in ans){
        if (ans.STATE == this.state.STARTING){
            ans.STATE = this.state.RUNNING;
        } else if (ans.STATE == this.state.STOPPING){
            ans.STATE = this.state.STOP;
        }
    }
    //parse id to uuid
    var params = [];
    var p = this;
    if ('VL2ID' in ans){
        params.push(function(a, f){
            p.selectSql([Vl2.prototype.tableName, 'id', ans.VL2ID],
                function(data){
                    if (data.length > 0){
                        if (p.action == 'modify'){
                            if ('VIF' in ans){
                                ans['VIF']['SUBNET_LCUUID'] = data[0].lcuuid;
                            } else{
                                ans['VIF'] = {'SUBNET_LCUUID':data[0].lcuuid};
                            }
                        } else
                            ans.VL2_LCUUID = data[0].lcuuid;
                    } else{
                        logger.info('vl2 found no data of id', ans.VL2ID);
                        ans.VL2_LCUUID = '';
                    };
                    delete(ans.VL2ID);
                    f(a)
                },
                function(){
                    ans.VL2_LCUUID = '';
                    delete(ans.VL2ID);
                    f(a);
                }
            )
        });
    }
    if ('VNETID' in ans){
        params.push(function(a, f){
            p.selectSql([Vdc.prototype.tableName, 'id', ans.VNETID],
                function(data){
                    if (data.length > 0){
                        ans.VNET_LCUUID = data[0].lcuuid;
                    } else{
                        logger.info('vdc found no data of id', ans.VNETID);
                        ans.VNET_LCUUID = '';
                    };
                    delete(ans.VNETID);
                    f(a)
                },
                function(){
                    ans.VNET_LCUUID = '';
                    delete(ans.VNETID);
                    f(a);
                }
            )
        });
    }
    if ('VCLOUDID' in ans){
        params.push(function(a, f){
            p.selectSql([Vpc.prototype.tableName, 'id', ans.VCLOUDID],
                function(data){
                    if (data.length > 0){
                        ans.VCLOUD_LCUUID = data[0].lcuuid;
                    } else{
                        logger.info('vdc found no data of id', ans.VNETID);
                        ans.VCLOUD_LCUUID = '';
                    };
                    delete(ans.VCLOUDID);
                    f(a)
                },
                function(){
                    ans.VCLOUD_LCUUID = '';
                    delete(ans.VCLOUDID);
                    f(a);
                }
            )
        });
    }

    if ('VIF' in ans && 'SUBNET' in ans.VIF){
        params.push(function(a, f){
            p.selectSql([Vl2.prototype.tableName, 'id', ans.VIF.SUBNET],
                function(data){
                    if (data.length > 0){
                        ans.VIF.SUBNET = data[0].lcuuid;
                    } else{
                        logger.info('vl2 found no data of id', ans.VIF.SUBNET);
                        ans.VIF.SUBNET = '';
                    };
                    f(a)
                },
                function(){
                    ans.VIF.SUBNET = '';
                    f(a);
                }
            )
        });
    }

    if (data.allocation_type == 'auto') {
        if ('ALLOCATION_POOLS' in ans) {
            ans.ALLOCATION_POOLS = data.alloc_pools;
        } else {
            if ('PRODUCT_SPECIFICATION_LCUUID' in ans) {
                ans.ALLOCATION_POOLS = new Array();
                params.push(function(a, f) {
                    p.selectSql(
                        [p.pool_product_spec_tableName,
                         'product_spec_lcuuid',
                         ans.PRODUCT_SPECIFICATION_LCUUID],
                        function(res_data) {
                            if (res_data.length > 0) {
                                for (i = 0; i < res_data.length; i++) {
                                    ans.ALLOCATION_POOLS[i] = res_data[i].pool_lcuuid;
                                }
                            } else {
                                logger.error('can not find pool with product_specification',
                                             ans.PRODUCT_SPECIFICATION_LCUUID);
                            }
                            f(a);
                        },
                        function() {
                            logger.error('select DB failed');
                            f(a);
                        }
                    )
                });
            }
        }
    }

    if (flag) {
        if(!('passwd' in data)) {
            params.push(function(a, f){
                p.selectSql([p.user_tableName, 'id', ans.USERID],
                    function(data){
                        if (data.length > 0) {
                            ans.INIT_PASSWD = data[0].vmpasswd;
                            f(a);
                        } else {
                            logger.info('user found no data of id', ans.USERID);
                            errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,
                                                DESCRIPTION: 'userid is invalid'});
                        };
                    },
                    function() {
                        logger.error('select DB failed');
                        errorcallback(500, {OPT_STATUS: constr.OPT.DB_QUERY_ERROR,
                                            DESCRIPTION: 'DB Error when lookup user'});
                    }
                )
            });
        } else {
            ans.INIT_PASSWD = data.passwd;
        }
    }

    new flow.parallel(params).fire('', function(){
        if (flag){
            ans.ALLOCATION_TYPE = data.allocation_type.toUpperCase();
        } else{
            logger.info(ans);
            // only update params
            if ('lcuuid' in ans) {
                delete(ans.lcuuid);
            }
            if ('VDI_SYS_SIZE' in ans) {
                delete(ans.VDI_SYS_SIZE)
            }
        }
        logger.debug(ans);
        callback(ans)
    });
}

Vm.prototype.parseApiToFdbData = function(data){
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


Vm.prototype.writeToSql = function(callback, errorcallback, deleteflag){
    var p = this;
    if('domain' in  p.data_diff){
        delete(p.data_diff.domain);
    }
    for(var i in p.data_diff){
        logger.debug('writing to sql ... ',i, p.data_diff, p.data);
        //get pre data and diff and send it to state_sniffer
        var params = [];
        var pre_data = '';
        params.push(
            function(a, f){
                var t ;
                if ('lcuuid' in p.data){
                    t = [p.tableName, 'lcuuid', p.data.lcuuid];
                } else if ('id' in p.data){
                    t = [p.tableName, 'id', p.data.id];
                } else{
                    throw new Error('id or lcuuid not found in data_diff/data');
                }
                p.selectSql(t,
                    function(ans){
                        if (ans.length > 0){
                            pre_data = ans[0];
                            p.data.order_id = ans[0].order_id;
                            p.data_diff.id = pre_data.id;
                            f(a);
                        }
                    },
                    function(e){logger.info(e); f(a)}
                )
            }
        );
        if (deleteflag != true){
            params.push(
                function(a, f){
                    p.updateSql(
                        [p.tableName, p.data_diff, 'id', p.data.id],
                        function(){logger.debug('data_diff stored to sql'); f(a);},
                        function(e){logger.info(e); f(a)}
                    );
                }
            );
        } else{
            params.push(
                function(a, f){
                    p.deleteSql(
                        [p.tableName, 'id', p.data.id],
                        function(){logger.debug('vm deleted from sql'); f(a);},
                        function(e){logger.info(e); f(a)}
                    );
                }
            );
        }
        new flow.serial(params).fire('', function(a){
            var dbdiff = p.makeDiff(pre_data, p.data_diff);
            dbdiff.type = p.type;
            dbdiff.userid = pre_data.userid;
            var action_status = p.getActionStatus(p.data_diff);
            logger.info(p.action, action_status);
            dbdiff.id = pre_data.id;
            if (deleteflag == true){
                delete(dbdiff.bdb);
            }
            // Add vm charge function
            if (action_status == 'done') {
                logger.info("44444444444444444444444444444444444444444", action_status);
                logger.info("44444444444", p.action);
                switch (p.action) {
                    case 'create':
                        //p.start_charge_handler();
                        break;
                    case 'modify':
                        logger.info("55555555555555555555555555555555555555555555555555");
                        p.modify_charge_handler_to_bss();
                        break;
                    default:
                        break;
                }
            }
            var msg = {type:'user',
                       target:pre_data.userid,
                       msg:{action:p.action, state:action_status, type:'vm', id:pre_data.lcuuid, data:p.data}};
            msg.msg.id = pre_data.id;
            p.sendToMsgCenter(msg);
            callback();
        })
        return;
    }
    logger.debug('data_diff is null, ignore writing to sql');
}


Vm.prototype.parseBdbsToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = {DATA:[], OPT_STATUS:data.OPT_STATUS};

    for(var j=0; j<data.DATA.length; j++){
        result.DATA.push(this.parseBdbToFdb(data.DATA[j]));
    }
    return result;
}
Vm.prototype.parseCallbackToFdb = function(data){
    return this.parseBdbToFdb(data);
}
Vm.prototype.parseBdbToFdb = function(data){
    var cols = this.tableCols, key='';
    var ans = {};
    var p = this;
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[cols[i]] = data[key];
        } else if(cols[i] in data){
            ans[cols[i]] = data[cols[i]];
        }
    }
    //parse ip
    if ('VIF' in data){
        if ('IP' in data.VIF)
            ans['ip'] = data.VIF.IP;
        if ('NETMASK' in data.VIF)
            ans['netmask'] = data.VIF.NETMASK;
        if ('GATEWAY' in data.VIF)
            ans['gateway'] = data.VIF.GATEWAY;
    }
    if ('VDI_SYS_SIZE' in data){
        ans['sys_disk_size'] = data['VDI_SYS_SIZE'];
        delete(data['VDI_SYS_SIZE']);
    }
    if ('VDI_USER_SIZE' in data){
        ans['user_disk_size'] = data['VDI_USER_SIZE'];
        delete(data['VDI_USER_SIZE']);
    }
    if ('SNAPSHOTS' in data){
        if (data.SNAPSHOTS[0].STATE == 'COMPLETE')
            ans['snapshotstate'] = this.state.SNAPSHOT_CREATED;
        else if (data.SNAPSHOTS[0].STATE == 'DELETED')
            ans['snapshotstate'] = this.state.SNAPSHOT_DELETED;
        else if (data.SNAPSHOTS[0].STATE == 'ABNORMAL')
            ans['snapshotstate'] = this.state.SNAPSHOT_ABNORMAL;
        ans['snapshot_lcuuid'] = data.SNAPSHOTS[0].LCUUID;
        if ('NAME' in data.SNAPSHOTS[0]) {
            ans['snapshot_name'] = data.SNAPSHOTS[0].NAME;
        }
        if ('SIZE' in data.SNAPSHOTS[0]) {
            ans['snapshot_size'] = data.SNAPSHOTS[0].SIZE;
        }
    }
    if ('SNAPSHOT_LCUUID' in data) {
        ans['snapshot_lcuuid'] = data.SNAPSHOT_LCUUID;
    }
    if ('vnetid' in ans){
        delete(ans.vnetid);
    }
    if ('vcloudid' in ans){
        delete(ans.vcloudid);
    }
    if ('vl2id' in ans){
        delete(ans.vl2id);
    }
    return ans;
}

Vm.prototype.parseBdbToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = util._extend({}, data);
    result.DATA = this.parseBdbToFdb(result.DATA);
    return result;
}

Vm.prototype.get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var condition = 'select * from ?? where true';
    var param = [];
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    var fdb_vms = [];
    var ip_response = {};
    var response;

    if ('id' in data) {
        condition += ' and ??=?';
        param.push('id');
        param.push(data.id);
        flow_steps.push(function(a, f){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length > 0) {
                        data.lcuuid = ans[0].lcuuid;
                        f(a);
                    } else {
                        errorcallback(404, {ERR_MSG : 'can not find vm'});
                        app.STD_END();
                    }
                },
                function(a){errorcallback(a); app.STD_END()}
            );
        });
    }

    if ('userid' in data) {
        condition += ' and ??=?';
        param.push('userid');
        param.push(data.userid);
    }

    if ('order_id' in data) {
        condition += ' and ??=?';
        param.push('order_id');
        param.push(data.order_id);
    }

    if ('lcuuid' in data) {
        condition += ' and ??=?';
        param.push('lcuuid');
        param.push(data.lcuuid);
    }

    if ('epc_id' in data) {
        if (data.epc_id != 0 && !('userid' in data)) {
            flow_steps.push(function(a, f) {
                p.selectSql(
                    [Epc.prototype.tableName, 'id', data.epc_id],
                    function(ans){
                        if (ans.length > 0) {
                            data.userid = ans[0].userid;
                            f(a);
                        } else{
                            errorcallback(404, {ERR_MSG : 'can not find user from epc'});
                            app.STD_END();
                        }
                    },
                    function(a){errorcallback(a); app.STD_END()}
                );
            })
        }
    }

    if ('state' in data) {
        condition += ' and ??=?';
        param.push('state');
        param.push(data.state);
    }

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            [Vm.prototype.tableName].concat(param),
            function(ans){
                fdb_vms = ans;
                f(a);
            },
            function(a){errorcallback(a); app.STD_END()}
        );
    });

    flow_steps.push(function(a, f){
        var i, j, flag;
        var lcuuid = '';
        var filter = {};
        if ('userid' in data) {
            filter.userid = data.userid;
        }
        if ('epc_id' in data) {
            filter.epc_id = data.epc_id;
        }
        if ('lb_lcuuid' in data) {
            filter.lb_lcuuid = data.lb_lcuuid;
        }
        if ('domain' in data) {
            filter.domain = data.domain;
        }
        if ('page_index' in data) {
            filter.page_index = data.page_index;
        }
        if ('page_size' in data) {
            filter.page_size = data.page_size;
        }
        if ('pool_type' in data) {
            filter.pool_type = data.pool_type;
        }
        if ('lcuuid' in data) {
            lcuuid = '/' + data.lcuuid;
        }
        p.sendData('/v1/vms' + lcuuid, 'get', filter, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                if (rdata.DATA instanceof Array) {
                    for (i = rdata.DATA.length - 1; i >= 0; --i) {
                        flag = 0;
                        for (j = 0; j < fdb_vms.length; j++) {
                            if (rdata.DATA[i].LCUUID == fdb_vms[j].lcuuid) {
                                if ([p.state.CREATING,
                                     p.state.STARTING,
                                     p.state.STOPPING,
                                     p.state.DELETING].indexOf(fdb_vms[j].state) > -1) {
                                    rdata.DATA[i].STATE = fdb_vms[j].state;
                                }
                                if (('state' in data) && (rdata.DATA[i].STATE != data.state)) {
                                    break;
                                }
                                flag = 1;
                                rdata.DATA[i].ID = fdb_vms[j].id;
                                rdata.DATA[i].CREATE_TIME = fdb_vms[j].create_time.toMysqlFormat();
                                rdata.DATA[i].PRODUCT_SPECIFICATION_LCUUID =
                                    fdb_vms[j].product_specification_lcuuid;
                                break;
                            }
                        }
                        if (flag == 0) {
                            rdata.DATA.splice(i, 1);
                        }
                    }
                } else {
                    rdata.DATA.ID = fdb_vms[0].id;
                    if ([p.state.CREATING,
                         p.state.STARTING,
                         p.state.STOPPING,
                         p.state.DELETING].indexOf(fdb_vms[0].state) > -1) {
                        rdata.DATA.STATE = fdb_vms[0].state;
                    }
                    rdata.DATA.CREATE_TIME = fdb_vms[0].create_time;
                    rdata.DATA.PRODUCT_SPECIFICATION_LCUUID =
                        fdb_vms[0].product_specification_lcuuid;
                }
            }
            response = rdata;
            f(a);
        },
        function(a) {errorcallback(a); app.STD_END()});
    });

    flow_steps.push(function(a, f){
        var filter = {};
        var isp = new Isp();
        var i;
        if ('userid' in data) {
            filter.userid = data.userid;
        }
        isp.get_user_ip_resources(
            filter,
            function(ans) {
                for (i = 0; i < ans.DATA.length; ++i) {
                    ip_response[ans.DATA[i].IP_RESOURCE_LCUUID] = ans.DATA[i];
                }
                f(a);
            },
            function(a) {f(a)}
        );
    });

    flow_steps.push(function(a, f){
        var i, j;
        var vms = []
        if (response.DATA instanceof Array) {
            vms = response.DATA;
        } else {
            vms[0] = response.DATA;
        }
        for (i = 0; i < vms.length; ++i) {
            var vm = vms[i];
            for (j = 0; j < vm.INTERFACES.length; ++j) {
                var vif = vm.INTERFACES[j];
                if (vif.IF_TYPE == 'WAN') {
                    var k;
                    for (k = 0; k < vif.WAN.IPS.length; ++k) {
                        vif.WAN.IPS[k].IP_RESOURCE = ip_response[vif.WAN.IPS[k].IP_RESOURCE_LCUUID];
                    }
                } else if (vif.IF_TYPE == 'LAN' && vif.LAN.VL2_LCUUID != null) {
                    (function(vif){
                        flow_steps.push(function(a, f){
                            var vl2 = new Vl2();
                            vl2.get(
                                {'id': vif.LAN.VL2_LCUUID},
                                function(ans) {
                                    vif.LAN.VL2 = ans.DATA;
                                    f(a);
                                },
                                function(a) {vif.LAN.VL2 = null; f(a)}
                            );
                        });
                    })(vif);
                }
            }
        }

        flow_steps.push(function(a, f){
            f(a);
        });

        f(vms);
    });
    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var epc = new Epc();
    epc.fill_epc_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(response);});
}

Vm.prototype.create = function(data, callback, errorcallback){
    var p = this;
    p.action = 'create';
    var check_res = p.checkApiCreateData(data, errorcallback);
    if (!check_res){
        logger.info('Create request check failed')
        return;
    }
    var callback_check_name = function(flag){
        if (flag){
            logger.info('Create request check vm name is having')
            errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_ALREADY_EXIST, DESCRIPTION: 'Resource already exist.'});
            return;
        }else{
            logger.info('Create request check vm name is no used')
        }

        var operator_name = data.operator_name;
        var next = function(bdbdata){
            p.sendData('/v1/vms', 'post', bdbdata, function(sCode, rdata){
                logger.info('remote server res :', rdata);
                // app now handles  only one vm res in one request
                var res_data = p.parseBdbToFdbData(rdata);
                var newdata = res_data.DATA;
                if (res_data.OPT_STATUS != 'SUCCESS' || res_data.DATA.length==0){
                    errorcallback(500);
                } else if (0 != newdata.errno) {
                    newdata.create_time = new Date().toMysqlFormat();
                    newdata.order_id = data.order_id;
                    p.insertSql(
                        [p.tableName, newdata],
                        function(ans) {
                            operationLog.create_and_update(
                                {operation:'create', objecttype:data.type, objectid:ans.insertId,
                                 object_userid:newdata.userid, operator_name:operator_name, opt_result:2,error_code:newdata.errno},
                                 function(){},
                                 function(){});
                            callback(lc_utils.upperJsonKey(res_data));
                            p.sendToMsgCenter({
                                type:'user', target:data.userid,
                                msg:{action:'create', state:'failed', type:'vm', id:ans.insertId, data:newdata}
                            });
                        },
                        errorcallback
                    );
                } else {
                    newdata.state = p.state.CREATING;
                    newdata.create_time = new Date().toMysqlFormat();
                    newdata.order_id = data.order_id;
                    p.insertSql(
                        [p.tableName, newdata],
                        function(ans) {
                            operationLog.create({operation:'create', objecttype:data.type, objectid:ans.insertId,
                                                 object_userid:newdata.userid, operator_name:operator_name});
                            callback(lc_utils.upperJsonKey(res_data));
                            p.setData(newdata);
                            var msg = {type:'user',
                               target:newdata.userid,
                               msg:{action:p.action, state:'start', type:'vm', id:newdata.lcuuid, data:newdata}};
                            msg.msg.id = ans.insertId;
                            p.sendToMsgCenter(msg);
                        },
                        errorcallback
                    );
                }
            },
            errorcallback
            );
        }
        p.parseApiToBdbData(data, next, errorcallback, true);
    }
     p.checkVMName(data, callback_check_name, errorcallback);
}

Vm.prototype.update = function(data, callback, errorcallback){
    logger.debug('updating vm', data);
    var p = this;
    var fdbdata = p.parseApiToFdbData(data);
    if ('lcuuid' in fdbdata){
        delete(fdbdata.lcuuid);
    }

    var next = function(bdbdata){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(vmans){
                if (vmans.length > 0){

                    data.lcuuid = vmans[0].lcuuid;
                    p.sendData('/v1/vms/'+data.lcuuid, 'patch', bdbdata, function(sCode, rdata){
                        if (sCode == 200){
                            p.updateSql(
                                [p.tableName, fdbdata, 'lcuuid', data.lcuuid],
                                function(ans){
                                    callback(rdata);
                                    var msg = {type:'user',
                                       target:vmans[0].userid,
                                       msg:{action:p.action, state:'start', type:'vm', id:data.lcuuid, data:fdbdata}};
                                    msg.msg.id = vmans[0].id;
                                    p.sendToMsgCenter(msg);
                                },
                                errorcallback
                            )
                        } else{
                            errorcallback(sCode);
                        }
                    }, errorcallback);

                } else{
                    errorcallback(404);
                }
            },
            errorcallback
        )
    }
    p.parseApiToBdbData(data, next, errorcallback, false);

};


Vm.prototype.start = function(data, callback, errorcallback){
    logger.debug('starting vm', data);
    var p = this;
    p.action = 'start';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.state = p.state.STARTING;
                var type = 'vm';
                if ('role' in ans[0]) {
                    if (ans[0].role == 2) {
                        type = 'lb';
                    } else if (ans[0].role == 6) {
                        type = 'vfw';
                    }
                }
                operationLog.create({operation:'start', objecttype:type, objectid:data.id,
                    object_userid:ans[0].userid, operator_name:data.operator_name});
                p.update(data, callback, errorcallback);
            } else{
                logger.error('vm id %d not found', data.id);
                errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,
                                    DESCRIPTION: 'Can not find vm'});
            }
        },
        function(){errorcallback(500, {OPT_STATUS: constr.OPT.DB_QUERY_ERROR,
                                       DESCRIPTION: 'DB Error when lookup vm'})}
    );
}
Vm.prototype.modify = function(data, callback, errorcallback){
    logger.info('modifying vm', data);
    var p = this;
    p.action = 'modify';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                p.origin_template = {};
                p.origin_template.product_specification_lcuuid = ans[0].product_specification_lcuuid;
                p.origin_template.lcuuid = ans[0].lcuuid;
                p.origin_template.vcpu_num = ans[0].vcpu_num;
                p.origin_template.mem_size = ans[0].mem_size;
                p.origin_template.user_disk_size = ans[0].user_disk_size;
                p.origin_template.userid = ans[0].userid;
                p.origin_template.domain = ans[0].domain;
                p.origin_template.name = ans[0].name;

                if (ans[0].user_disk_size > p.data.user_disk_size) {
                    errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'vm modify no to small'});
                    return;
                }
                var flag = false;

                var flow_steps = [];
                var app = new flow.serial(flow_steps);

                if ("product_specification_lcuuid" in data) {
                    flow_steps.push(function(a, f) {
                        var condition = 'select useruuid from ?? where ??=?';
                        var balance_data = {'VMS':[{}]};
                        p.executeSql(condition)([Vm.prototype.user_tableName, 'id', ans[0].userid],function(user){
                            if (user != null && user.length > 0){
                                balance_data.DOMAIN = ans[0].domain;
                                balance_data.USERUUID = user[0].useruuid;
                                balance_data.USERID = ans[0].userid;
                                balance_data.VMS[0].VCPU_NUM = data.vcpu_num;
                                balance_data.VMS[0].MEM_SIZE = data.mem_size;
                                balance_data.VMS[0].SYS_DISK_SIZE = ans[0].sys_disk_size;
                                balance_data.VMS[0].USER_DISK_SIZE = data.user_disk_size;
                                balance_data.VMS[0].PRODUCT_SPECIFICATION_LCUUID = data.product_specification_lcuuid;
                                balance_data.VMS[0].DOMAIN = ans[0].domain;
                                p.callCharge('/balance-checks', 'post', balance_data, function(resp){
                                        f(a);
                                    },function() {
                                        logger.debug('check vm_modify balance failed');
                                        errorcallback(402, {OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE,ERR_MSG : 'check vm_modify balance failed'});
                                        app.STD_END();
                                });
                            }
                        }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'change userid to useruuid failed'});app.STD_END()});
                    });
                }

                function getSession(userid, callback, errorcallback){
                    var condition = 'select session,useruuid from ?? where ??=?';
                    p.executeSql(condition)([Vm.prototype.user_tableName, 'id', userid],function(ans){
                        if (ans != null && ans.length > 0){
                            if (ans[0].session != '0'){
                                callback(ans);
                                return;
                            } else{
                                getSession(1, callback, errorcallback)
                            }
                        }
                    }, errorcallback);
                }

                flow_steps.push(function(a, f) {
                    getSession(ans[0].userid, function(ans){
                        if (ans != null && ans.length > 0) {
                            p.origin_template.session = ans[0].session;
                            p.origin_template.useruuid = ans[0].useruuid;
                        }
                        f(true);
                    },function(a){errorcallback(a), app.STD_END()});
                })

                flow_steps.push(function(flag, f) {
                    if(!flag){
                        errorcallback(400, {OPT_STATUS: constr.OPT.INSUFFICIENT_BALANCE,DESCRIPTION: constr.OPT_EN.INSUFFICIENT_BALANCE});
                        app.STD_END();
                        return;
                    }else{
                        f(flag);
                    }
                })

                flow_steps.push(function(flag, f) {
                    var type = 'vm';
                    if ('role' in ans[0]) {
                        if (ans[0].role == 2) {
                            type = 'lb';
                        } else if (ans[0].role == 6) {
                            type = 'vfw';
                        }
                    }
                    operationLog.create({operation:'modify', objecttype:type, objectid:data.id,
                        object_userid:ans[0].userid, operator_name:data.operator_name});
                    p.update(data, callback, errorcallback);
                })
                app.fire('',function() {logger.info('order_id create finished.');});
            } else{
                logger.error('vm id %d not found', data.id);
                errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,
                                    DESCRIPTION: 'Can not find vm'});
            }
        },
        function(){errorcallback(500, {OPT_STATUS: constr.OPT.DB_QUERY_ERROR,
                                       DESCRIPTION: 'DB Error when lookup vm'})}
    );
}

Vm.prototype.stop = function(data, callback, errorcallback){
    logger.debug('stopping vm', data);
    var p = this;
    p.action = 'stop';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.state = p.state.STOPPING;
                var type = 'vm';
                if ('role' in ans[0]) {
                    if (ans[0].role == 2) {
                        type = 'lb';
                    } else if (ans[0].role == 6) {
                        type = 'vfw';
                    }
                }
                operationLog.create({operation:'stop', objecttype:type, objectid:data.id,
                    object_userid:ans[0].userid, operator_name:data.operator_name});
                p.update(data, callback, errorcallback);
            } else{
                logger.error('vm id %d not found', data.id);
                errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,
                                    DESCRIPTION: 'Can not find vm'});
            }
        },
        function(){errorcallback(500, {OPT_STATUS: constr.OPT.DB_QUERY_ERROR,
                                       DESCRIPTION: 'DB Error when lookup vm'})}
    );
}

Vm.prototype.get_snapshot = function(data, callback, errorcallback){
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var snapshots = [];
    var response;

    flow_steps.push(function(a, f){
        var lcuuid = '';
        var filter = {};
        if ('userid' in data) {
            filter.userid = data.userid;
        }
        if ('vm_lcuuid' in data) {
            filter.vm_lcuuid = data.vm_lcuuid;
        }
        if ('page_index' in data) {
            filter.page_index = data.page_index;
        }
        if ('page_size' in data) {
            filter.page_size = data.page_size;
        }
        if ('lcuuid' in data) {
            lcuuid = '/' + data.lcuuid;
        }
        p.sendData('/v1/snapshots' + lcuuid, 'get', filter,
            function(sCode, rdata) {
                response = rdata;
                if (response.DATA instanceof Array) {
                    snapshots = response.DATA;
                } else {
                    snapshots[0] = response.DATA;
                }
                f(snapshots);
            },
            function(a) {errorcallback(a); app.STD_END()}
        );
    });
    user.fill_user_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(response);});
}

Vm.prototype.snapshot = function(data, callback, errorcallback){
    logger.debug('snapshotting vm '+data);
    var p = this;
    p.action = 'snapshot';
    var response = {};
    var flag = false;
    var vmName ;
    var app = new flow.serial([
        function(a, f){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length > 0){
                        balance_data = {'VMSNAPSHOT':{}};
                        p.selectSql([Vm.prototype.user_tableName, 'id', ans[0].userid],function(user){
                            p.selectSql([Vm.prototype.product_spec_tableName, 'product_type', Vm.prototype.snapshot_product_type], function(ps){
                               if (user != null && user.length > 0 && ps != null && ps.length > 0){
                                  balance_data.USERUUID = user[0].useruuid;
                                  balance_data.USERID = ans[0].userid;
                                  balance_data.DOMAIN = ans[0].domain;
                                  balance_data.VMSNAPSHOT.DOMAIN = ans[0].domain;
                                  balance_data.VMSNAPSHOT.SIZE = ans[0].sys_disk_size + ans[0].user_disk_size;
                                  balance_data.VMSNAPSHOT.PRODUCT_SPECIFICATION_LCUUID = ps[0].lcuuid;
                                  p.callCharge('/balance-checks', 'post', balance_data, function(resp){

                                      data.lcuuid = ans[0].lcuuid;
                                      data.userid = ans[0].userid;
                                      data.domain = ans[0].domain;
                                      vmName = ans[0].name;
                                      data.sys_disk_size = ans[0].sys_disk_size;
                                      data.user_disk_size = ans[0].user_disk_size;
                                      f(ans[0].lcuuid);
                                  },function() {
                                      logger.debug('check snapshot balance failed');
                                      errorcallback(402, {OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE,ERR_MSG : 'check snapshot balance failed'});
                                      app.STD_END();
                                      });
                               }
                            }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'get snapshot product_specification_lcuuid failed'});app.STD_END()});
                        }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'change userid to useruuid failed.'}); app.STD_END()});
                    } else {
                        response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                        response.DESCRIPTION = "VM to snapshot not found";
                        errorcallback(404, response);
                        app.STD_END();
                    }
                },
                function(){
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "DB Error when lookup the snapshot vm";
                    errorcallback(500, response);
                    app.STD_END();
                }
            )
        },
        function(a, f){
            p.sendData('/v1/vms/'+ a +'/snapshots', 'get', '',
                function(sCode, data){
                    if ('DATA' in data && 'SNAPSHOTS' in data.DATA && data.DATA.SNAPSHOTS.length){
                        logger.info('VM ', a,  ' snapshot already exist');
                        response.OPT_STATUS = constr.OPT.SNAPSHOT_ALREADY_EXIST;
                        response.DESCRIPTION = "Snapshot already exist";
                        errorcallback(400, response);
                        app.STD_END();
                    } else {
                        f(data.lcuuid);
                    }
                },
                function(sCode, resp){
                    logger.info('Get VM ', a, ' snapshot api error');
                    try {
                        response = JSON.parse(JSON.stringify(resp));
                    } catch(e) {
                        response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                        response.DESCRIPTION = "API Error when get vm snapshot";
                    }
                    errorcallback(sCode, response);
                    app.STD_END();
                }
            )
        },
        function(a, f){
            operationLog.create({operation:'snapshot', objecttype:'vm', objectid:data.id,
                object_userid:data.userid, operator_name:data.operator_name});
            p.sendData('/v1/vms/'+ data.lcuuid +'/snapshots', 'post', '',function(sCode, data){
                if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS'){
                    callback(data);
                } else {
                    logger.info('Snapshot VM ', vmName,  'failed');
                    operationLog.update({objecttype:'vm', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                    errorcallback(data);
                    app.STD_END();
                }
            },function(sCode, resp){
                logger.info('Snapshot VM ', vmName,  'failed');
                operationLog.update({objecttype:'vm', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when create vm snapshot";
                }
                errorcallback(sCode, response);
                app.STD_END();
            })
        }
    ]);
    app.fire(data, function(){});
}

//data: {id:, lcuuid:,}
Vm.prototype.delsnapshot = function(data, callback, errorcallback){
    logger.debug('deleting vm '+data.id+' \'s snapshot');
    var p = this;
    p.action = 'delsnapshot';
    var response = {};

    var app = new flow.serial([
        function(a, f){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length){
                        data.lcuuid = ans[0].lcuuid;
                        data.userid = ans[0].userid;
                        f(ans[0].lcuuid);
                    } else{
                        response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                        response.DESCRIPTION = "VM with snapshot not found";
                        errorcallback(404, response);
                        app.STD_END();
                    }
                },
                function(){
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "DB Error when lookup the snapshot vm";
                    errorcallback(500, response);
                    app.STD_END();
                }
            )
        },
        function(a, f){
            p.sendData('/v1/vms/'+ a +'/snapshots', 'get', '',
                function(sCode, data){
                    if ('DATA' in data && 'SNAPSHOTS' in data.DATA && data.DATA.SNAPSHOTS.length){
                        if (data.DATA.SNAPSHOTS[0].STATE != 'COMPLETE'){
                            response.OPT_STATUS = constr.OPT.SNAPSHOT_DELETE_PROHIBITED;
                            response.DESCRIPTION = "Snapshot is reverting don't to delete";
                            errorcallback(400, response);
                            app.STD_END();
                        }
                        f(data.DATA.SNAPSHOTS[0].LCUUID);
                    } else {
                        logger.info('VM ', a,  ' snapshot not exist');
                        response.OPT_STATUS = constr.OPT.SNAPSHOT_NOT_EXIST;
                        response.DESCRIPTION = "Snapshot not exist";
                        errorcallback(400, response);
                        app.STD_END();
                    }
                },
                function(sCode, resp){
                    logger.info('Get VM ', a, ' snapshot api error');
                    try {
                        response = JSON.parse(JSON.stringify(resp));
                    } catch(e) {
                        response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                        response.DESCRIPTION = "API Error when get vm snapshot";
                    }
                    errorcallback(sCode, response);
                    app.STD_END();
                }
            )
        },

        function(a, f){
            operationLog.create({operation:'delsnapshot', objecttype:'vm', objectid:data.id,
                object_userid:data.userid, operator_name:data.operator_name});
            p.sendData('/v1/vms/'+ data.lcuuid + '/snapshots/'+ a, 'delete', '',
                function(sCode, data){
                    if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS'){
                        callback(data);
                    } else {
                        logger.info('Delete VM ', a,  ' snapshot failed');
                        operationLog.update({objecttype:'vm', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                        errorcallback(data);
                        app.STD_END();
                    }
                },
                function(sCode, resp){
                    logger.info('Delete VM ', a,  ' snapshot failed');
                    operationLog.update({objecttype:'vm', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                    try {
                        response = JSON.parse(JSON.stringify(resp));
                    } catch(e) {
                        response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                        response.DESCRIPTION = "API Error when delete vm snapshot";
                    }
                    errorcallback(sCode, response);
                    app.STD_END();
                }
            )
        },
    ]);
    app.fire(data, function(){});
}

Vm.prototype.revert = function(data, standard_action, callback, errorcallback) {
    var p = this;
    var vifs_data = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(
        standard_action('recoversnapshot')('vm', data, function(sCode, resp) {
            var a = Array.prototype.splice.call(arguments, 0);
            callback.apply(this, a);
        })
    )

    flow_steps.push(function(a, f){
        if (a.data.snapshotstate == p.state.SNAPSHOT_ABNORMAL) {
            logger.info('Recover VM ', a.data.lcuuid, ' snapshot failed');
            app.STD_END();
        } else {
            standard_action('start')('vm', {id: data.id,operator_name:data.operator_name}, function(){})(a, f);
        }
    })

    flow_steps.push(function(a, f){
        /* Wait VM vagent start */
        setTimeout(function(){f(a);}, 60000);
    })

    flow_steps.push(function(a, f){
        p.sendData('/v1/vms/'+ a.data.lcuuid, 'get', '',
            function(sCode, resp){
                if (resp.OPT_STATUS == 'SUCCESS') {
                    f(resp.DATA);
                } else {
                    logger.info('VM ', a.data.lcuuid, ' reverted not found');
                    app.STD_END();
                }
            },
            function(){
                logger.info('API Error get reverted VM ', a.data.lcuuid);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        vifs_data.GATEWAY = a.GATEWAY;
        vifs_data.LOOPBACK_IPS = a.LOOPBACK_IPS;
        vifs_data.INTERFACES = [];
        for (var i = 0; i < a.INTERFACES.length; i++) {
            if (a.INTERFACES[i].IF_TYPE == 'CONTROL') {
                continue;
            } else if (a.INTERFACES[i].IF_TYPE == 'SERVICE') {
                vifs_data.INTERFACES[i].IF_TYPE = a.INTERFACES[i].IF_TYPE;
                vifs_data.INTERFACES[i].STATE = a.INTERFACES[i].STATE;
                vifs_data.INTERFACES[i].IF_INDEX = a.INTERFACES[i].IF_INDEX;
            } else {
                vifs_data.INTERFACES[i] = a.INTERFACES[i];
            }
        }
        p.sendData('/v1/vms/'+ data.lcuuid, 'patch', vifs_data,
            function(sCode, resp) {
                if (sCode != 200){
                    logger.info('Config VM ', data.lcuuid, ' interfaces failed');
                    p.sendToMsgCenter({
                        type:'user', target:a.USERID,
                        msg:{action:'modifyinterface', state:'failed', type:'vm', id:data.id}
                    });
                    operationLog.create_and_update(
                        {operation:'modifyinterface', objecttype:'vm',
                         objectid:data.id, object_userid:a.USERID,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                         function(){},
                         function(){});
                    app.STD_END();
                } else {
                    p.sendToMsgCenter({
                        type:'user', target:a.USERID,
                        msg:{action:'modifyinterface', state:'done', type:'vm', id:data.id}
                    });
                    operationLog.create_and_update(
                        {operation:'modifyinterface', objecttype:'vm',
                         objectid:data.id, object_userid:a.USERID,
                         operator_name:data.operator_name, opt_result:1},
                        function(){},
                        function(){});
                    f(a);
                }
            },
            function(){
                logger.info('API Error config VM ', data.lcuuid, ' interfaces');
                p.sendToMsgCenter({
                    type:'user', target:a.USERID,
                    msg:{action:'modifyinterface', state:'failed', type:'vm', id:data.id}
                });
                operationLog.create_and_update(
                    {operation:'modifyinterface', objecttype:'vm',
                     objectid:data.id, object_userid:a.USERID,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){},
                    function(){});
                app.STD_END();
            }
        )
    })

    app.fire(
        '',
        function(){
            logger.info('Revert vm', data.lcuuid, 'finished');
        }
    );
}

Vm.prototype.recoversnapshot = function(data, callback, errorcallback){
    logger.debug('recovering vm '+data.id+' \'s snapshot');
    var p = this;
    p.action = 'recoversnapshot';
    var response = {};

    var app = new flow.serial([
        function(a, f){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length){
                        data.lcuuid = ans[0].lcuuid;
                        data.userid = ans[0].userid;
                        f(ans[0].lcuuid);
                    } else{
                        response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                        response.DESCRIPTION = "VM with snapshot not found";
                        errorcallback(404, response);
                        app.STD_END();
                    }
                },
                function(){
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "DB Error when lookup the snapshot vm";
                    errorcallback(500, response);
                    app.STD_END();
                }
            )
        },
        function(a, f){
            p.sendData('/v1/vms/'+ a +'/snapshots', 'get', '',
                function(sCode, data){
                    if ('DATA' in data && 'SNAPSHOTS' in data.DATA && data.DATA.SNAPSHOTS.length){
                        f(data.DATA.SNAPSHOTS[0].LCUUID);
                    } else {
                        logger.info('VM ', a, ' snapshot not exist');
                        response.OPT_STATUS = constr.OPT.SNAPSHOT_NOT_EXIST;
                        response.DESCRIPTION = "Snapshot not exist";
                        errorcallback(400, response);
                        app.STD_END();
                    }
                },
                function(sCode, resp){
                    logger.info('Get VM ', a, ' snapshot api error');
                    try {
                        response = JSON.parse(JSON.stringify(resp));
                    } catch(e) {
                        response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                        response.DESCRIPTION = "API Error when get vm snapshot";
                    }
                    errorcallback(sCode, response);
                    app.STD_END();
                }
            )
        },
        function(a, f){
            operationLog.create({operation:'recoversnapshot', objecttype:'vm', objectid:data.id,
                object_userid:data.userid, operator_name:data.operator_name});
            p.sendData('/v1/vms/' + data.lcuuid + '/snapshots/'+ a + '/reversion', 'post', '',
                function(sCode, data){
                    if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS'){
                        callback(data);
                    } else {
                        logger.info('Recover VM ', a,  ' snapshot failed');
                        operationLog.update({objecttype:'vm', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                        errorcallback(data);
                        app.STD_END();
                    }
                },
                function(sCode, resp){
                    logger.info('Recover VM ', a,  ' snapshot failed');
                    try {
                        response = JSON.parse(JSON.stringify(resp));
                    } catch(e) {
                        response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                        response.DESCRIPTION = "API Error when revert vm snapshot";
                    }
                    errorcallback(sCode, response);
                    app.STD_END();
                }
            )
        }
    ]);
    app.fire(data, function(){});
}

Vm.prototype.del = function(data, callback, errorcallback){
    logger.debug('deleting vm', data);
    var p = this;
    p.action = 'delete';
    p.snapshots = [];
    var fdbdata = p.parseApiToFdbData(data);
    if ('lcuuid' in fdbdata){
        delete(fdbdata.lcuuid);
    }
    var next = function(){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(vmans){
                if (vmans.length > 0){
                    if ((vmans[0].state != p.state.TEMP) && (vmans[0].state != p.state.STOP)) {
                        errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_DELETE_PROHIBITED,
                                            DESCRIPTION: 'vm state is not STOP or TEMP'});
                        return;
                    }
                    data.lcuuid = vmans[0].lcuuid;
                    var type = 'vm';
                    if('role' in vmans[0]) {
                        if (vmans[0].role == 2) {
                            type = 'lb';
                        } else if (vmans[0].role == 6) {
                            type = 'vfw';
                        }
                    }
                    operationLog.create({operation:'delete', objecttype:type, objectid:data.id,
                        object_userid:vmans[0].userid, operator_name:data.operator_name});
                    var flow_steps = [];
                    var app = new flow.serial(flow_steps);
                    var clearVifMsSteps = [];
                    flow_steps.push(function(a, f){
                        p.sendData('/v1/vms/' + data.lcuuid, 'get', '',
                            function(sCode, rdata) {
                                f(rdata.DATA);
                            },
                            function(a) {errorcallback(a); app.STD_END()}
                        );

                    })
                    flow_steps.push(function(bdbdata, f){
                        bdbdata.INTERFACES.forEach(function(vif){
                            clearVifMsSteps.push(function(a, f){
                                ms.clearVifMs({lcuuid: data.lcuuid, if_index: vif.IF_INDEX}, f).resolve();
                            })
                        })
                        f();
                    })

                    flow_steps.push(clearVifMsSteps);

                    flow_steps.push(function(a, f){
                        logger.info('check vifs ans:', a)
                        var check = true;
                        a.some(function(val){
                            if (val === true)
                                return false;
                            if (typeof val == 'object'){
                                check = val;
                            } else {
                                check = false;
                            }
                            return true;
                        })
                        if (check === true){
                            f(true)
                        } else {
                            if (typeof check === 'object'){
                                errorcallback(check.code, check.body);
                            } else {
                                errorcallback(400, {OPT_STATUS: constr.OPT.VIF_IS_IN_FLOW});
                            }
                            app.STD_END();
                            f(false);
                        }
                    })
                    app.fire('', function(ack){
                        if (!ack)
                            return;
                    p.sendData('/v1/vms/'+data.lcuuid, 'delete', {}, function(sCode, rdata){
                        if (vmans[0].state == p.state.TEMP && vmans[0].errno == 851968 ) {
                            p.sendToMsgCenter({type:'user', target:vmans[0].userid, msg:{action:'delete', state:'done', type:'vm', id:data.id, data:vmans[0]}});
                        }
                        p.sendData('/v1/vms/' + vmans[0].lcuuid + '/snapshots', 'get', '',
                            function(sCode, data) {
                                if ('DATA' in data && 'SNAPSHOTS' in data.DATA && data.DATA.SNAPSHOTS.length) {
                                    for (var i = 0; i < data.DATA.SNAPSHOTS.length; i++) {
                                        p.snapshots.push(data.DATA.SNAPSHOTS[i].LCUUID)
                                    }
                                }
                            },
                            function(sCode, resp) {
                                logger.info('Get VM ', data.lcuuid, ' snapshot api error');
                            }
                        );
                        p.updateSql(
                            [p.tableName, {state:p.state.DELETING}, 'lcuuid', data.lcuuid],
                            function(ans){
                                p.data_diff = {};
                                callback(rdata);
                                var msg = {type:'user',
                                    target:vmans[0].userid,
                                    msg:{action:p.action, state:'start', type:type, id:data.lcuuid, data:{state:p.state.DELETING}}};
                                msg.msg.id = vmans[0].id;
                                p.sendToMsgCenter(msg);
                            },
                            errorcallback
                        )
                        },
                        errorcallback
                    );
                    })
                } else{
                    operationLog.update({objecttype:'vm', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                    errorcallback(404);
                }
            },
            errorcallback
        );
    }
    p.parseApiToBdbData(data, next, errorcallback, false);
}

Vm.prototype.isolate = function(data, callback, errorcallback){
    var p = this;
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(vmans){
            if (vmans.length > 0){
                data.lcuuid = vmans[0].lcuuid;
                p.sendData('/v1/vms/'+data.lcuuid+'/isolation', 'post', '', function(sCode, rdata){
                    if (sCode != 200){
                        errorcallback(sCode);
                    } else{
                        if (rdata.OPT_STATUS == 'SUCCESS'){
                            p.updateSql(
                                [p.tableName, {'flag':rdata.DATA.FLAG}, 'id', data.id],
                                function(ans){
                                    callback(rdata);
                                    p.sendToMsgCenter({type:'user', target:vmans[0].userid, msg:{action:'isolate', state:'done', type:'vm', id:vmans[0].id, data:p.parseBdbToFdb(rdata.DATA)}});
                                    operationLog.create_and_update({operation:'isolate', objecttype:'vm', objectid:data.id,
                                        object_userid:vmans[0].userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                                },
                                errorcallback
                            );
                        } else{
                                operationLog.create_and_update({operation:'isolate', objecttype:'vm', objectid:data.id,
                                object_userid:vmans[0].userid, operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'}, function(){}, function(){});
                            callback(rdata)
                        }
                    }
                },
               errorcallback
                )
            } else{
                errorcallback(404);
            }
        },
        errorcallback
    );

};
Vm.prototype.recreate = function(data, callback, errorcallback){
logger.debug('recreating vm '+data.id+' \'s snapshot');
    var p = this;
    p.action = 'recreate';
    var app = new flow.serial([
        function(a, f){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length){
                        data.lcuuid = ans[0].lcuuid;
                        data.userid = ans[0].userid;
                        p.data.lcuuid = ans[0].lcuuid;
                        f(ans[0].lcuuid);
                    } else{
                        errorcallback(404);
                        app.STD_END();
                    }
                },
                errorcallback
            )
        },
        function(a, f){
            operationLog.create({operation:p.action, objecttype:'vm', objectid:p.data.id,
                        object_userid:p.data.userid, operator_name:p.data.operator_name});
            p.sendData('/v1/vms/'+a, 'put', '', function(sCode, data){
                if ('DATA' in data && 'LCUUID' in data.DATA){
                    var fdbdata = {state : p.state.CREATING};
                    f(fdbdata);
                } else{
                    errorcallback(400);
                    app.STD_END();
                }
            },
            errorcallback
            )
        },
        function(a, f){
            p.updateSql(
                [p.tableName, a, 'id', p.data.id],
                function(ans){
                    p.sendToMsgCenter({type:'user', target:p.data.id, msg:{action:p.action, state:'start', type:'vm', id:p.data.id}});
                    f(a);
                },
                errorcallback
            )
        },
    ]);
    app.fire(data, function(a){callback(a);});

}

Vm.prototype.reconnect = function(data, callback, errorcallback){
    var p = this;
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(vmans){
            if (vmans.length > 0){
                data.lcuuid = vmans[0].lcuuid;
                p.sendData('/v1/vms/'+data.lcuuid+'/isolation', 'delete', '', function(sCode, rdata){
                    if (sCode != 200){
                        errorcallback(sCode);
                    } else{
                        if (rdata.OPT_STATUS == 'SUCCESS'){
                            p.updateSql(
                                [p.tableName, {'flag':rdata.DATA.FLAG}, 'id', data.id],
                                function(ans){
                                    callback(rdata);
                                    p.sendToMsgCenter({type:'user', target:vmans[0].userid, msg:{action:'reconnect', state:'done', type:'vm', id:vmans[0].id, data:p.parseBdbToFdb(rdata.DATA)}});
                                    operationLog.create_and_update({operation:'reconnect', objecttype:'vm', objectid:data.id,
                                        object_userid:vmans[0].userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                                },
                                errorcallback
                            );
                        } else{
                            operationLog.create_and_update({operation:'reconnect', objecttype:'vm', objectid:data.id,
                                object_userid:vmans[0].userid, operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'}, function(){}, function(){});
                            callback(rdata)
                        }
                    }
                },
               errorcallback
                )
            } else{
                errorcallback(404);
            }
        },
        errorcallback
    );


}

Vm.prototype.setepc = function(data, callback, errorcallback){
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    data.type = 'vm';
    var vm_lcuuid,role,lb_cluster_lcuuid =null;
    var log_type = 'setepc';
    if(data.epc_id== 0){
        log_type = 'remove_epc';

    }
    flow_steps.push(function(a, f) {
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans) {
                if (ans.length > 0) {
                    data.lcuuid = ans[0].lcuuid;
                    data.userid = ans[0].userid;
                    role = parseInt(ans[0].role);
                    if (role==2) {
                        data.type = 'lb';
                    } else if (role == 6) {
                        data.type = 'vfw';
                    }
                    vm_lcuuid = ans[0].lcuuid;
                    if('domain' in data){
                        if(ans[0].domain != data.domain){
                            errorcallback(400, {OPT_STATUS: constr.OPT.EPC_DOMAIN_DIFFERENT, DESCRIPTION: 'epc domain is different'});
                            app.STD_END();
                        }
                    }
                    f(a);
                } else {
                    errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: 'VM not found'});
                    app.STD_END();
                }
            },
            function() {
                errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB error when get VM'});
                app.STD_END();
            }
        );
    });

    if (data.epc_id == 0){
        var clearVifMsSteps = [];
        flow_steps.push(function(a, f){
            p.sendData('/v1/vms/' + vm_lcuuid, 'get', '',
                function(sCode, rdata) {
                    f(rdata.DATA);
                },
                function(a) {errorcallback(a); app.STD_END()}
            );

        })
        flow_steps.push(function(bdbdata, f){
            bdbdata.INTERFACES.forEach(function(vif){
                clearVifMsSteps.push(function(a, f){
                    ms.clearVifMs({lcuuid: data.lcuuid, if_index: vif.IF_INDEX}, f).resolve();
                })
            })
            f();
        })

        flow_steps.push(clearVifMsSteps);

        flow_steps.push(function(a, f){
            logger.info('check vifs ans:', a)
            var check = true;
            a.some(function(val){
                if (val === true)
                    return false;
                if (typeof val == 'object'){
                    check = val;
                } else {
                    check = false;
                }
                return true;
            })
            if (check === true){
                f()
            } else {
                if (typeof check === 'object'){
                    errorcallback(check.code, check.body);
                } else {
                    errorcallback(400, {OPT_STATUS: constr.OPT.VIF_IS_IN_FLOW});
                }
                app.STD_END();
            }
        })
    }

    flow_steps.push(function(a, f) {
        if(role == 2 && data.epc_id== 0){
            p.sendData('/v1/lbs/' + vm_lcuuid,'get','',function(sCode, resp) {
               if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                   lb_cluster_lcuuid = resp.DATA.LB_CLUSTER_LCUUID;
                   if(lb_cluster_lcuuid != null){
                       p.sendData('/v1/lb-clusters/' + lb_cluster_lcuuid , 'delete', '',function(sCode, resp) {
                           if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                               operationLog.create_and_update(
                                   {operation:'delete_ha_cluster', objecttype:'lb',
                                    objectid:data.id, object_userid:data.userid,
                                    operator_name:data.operator_name, opt_result:1},
                                    function(){},
                                    function(){});
                               f(a);
                           } else {
                               logger.info('Delete Lb-Cluster ', resp.lb_cluster_lcuuid, ' failed');
                               operationLog.create_and_update(
                                   {operation:'delete_ha_cluster', objecttype:'lb',
                                    objectid:data.id, object_userid:data.userid,
                                    operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                                   function(){},
                                   function(){});
                               errorcallback(resp);
                               app.STD_END();
                           }
                       },function(sCode, resp){
                           logger.info('API Error Delete Lb-Cluster ', lb_cluster_lcuuid);
                           operationLog.create_and_update(
                               {operation:'delete_ha_cluster', objecttype:'lb',
                                objectid:data.id, object_userid:data.userid,
                                operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                               function(){},
                               function(){});
                           try {
                               response = JSON.parse(JSON.stringify(resp));
                           } catch(e) {
                               response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                               response.DESCRIPTION = "API Error when delete lb ha cluster";
                           }
                           errorcallback(sCode, response);
                           app.STD_END();
                       })
                   }else{
                       f(a);
                   }
               } else {
                   app.STD_END();
               }
            },function() {
               app.STD_END();
           });
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(role == 2 && data.epc_id== 0){
            p.sendData('/v1/lbs/' + vm_lcuuid + '/lb-listeners' ,'get','',function(sCode, resp) {
               if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                   var inner_flow_steps = [];
                   var inner_app = new flow.serial(inner_flow_steps);
                   for(var i=0;i<resp.DATA.length;i++){
                       var listener_lcuuid = resp.DATA[i].LCUUID;
                       (function(listener_lcuuid){
                           inner_flow_steps.push(function(a, f) {
                               p.sendData('/v1/lbs/' + vm_lcuuid + '/lb-listeners/' + listener_lcuuid, 'delete', {},function(sCode, rdata) {
                                   p.sendData('/v1/lbs/' + vm_lcuuid , 'get', {}, function(sCode, rdata){
                                       if (rdata.OPT_STATUS == 'SUCCESS') {
                                           operationLog.create_and_update({operation:'delete_lb_listener', objecttype:'lb', objectid:rdata.DATA.ID,
                                                        object_userid:rdata.DATA.USERID, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                                           f(a);
                                       }
                                   },errorcallback);
                               }, function(sCode, resp){
                                   logger.info('API Error Delete Lb-listeners ', listener_lcuuid);
                                   operationLog.create_and_update({operation:'delete_lb_listener', objecttype:'lb', objectid:data.id,
                                                object_userid:data.userid, operator_name:data.operator_name, opt_result:2,error_code:'SERVICE_EXCEPTION'},
                                                function(){}, function(){});
                                   try {
                                       response = JSON.parse(JSON.stringify(resp));
                                   } catch(e) {
                                       response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                                       response.DESCRIPTION = "API Error when delete lb ha cluster";
                                   }
                                   errorcallback(sCode, response);
                                   app.STD_END();
                               });
                           });
                      })(listener_lcuuid);
                   }
                   inner_app.fire('', function(){logger.info('del lb ', vm_lcuuid,' listener finished.');f(a);});
               } else {
                   app.STD_END();
               }
            },function() {
               app.STD_END();
           });
        }else{
            f(a);
        }
    });

    var talker_data = {EPC_ID: data.epc_id}
    flow_steps.push(function(a, f) {
        p.sendData('/v1/vms/'+data.lcuuid, 'patch', talker_data, function(code, resp) {
            if (code == 200) {
                f(resp);
            } else {
                errorcallback(code, resp);
                app.STD_END();
            }
        },
        function(code, resp) {
            errorcallback(code, resp);
            app.STD_END();
        });
    });

    flow_steps.push(function(a, f){
        p.updateSql(
            [p.tableName, {'epc_id': data.epc_id}, 'id', data.id],
            function(ans){
                operationLog.create_and_update({
                    operation:log_type, objecttype:data.type, objectid:data.id,
                    object_userid:data.userid, operator_name:data.operator_name,
                    opt_result:1
                }, function(){}, function(){});
                callback(a);
                f(a);
            },
            function() {
                operationLog.create_and_update({
                    operation:log_type, objecttype:data.type, objectid:data.id,
                    object_userid:data.userid, operator_name:data.operator_name,
                    opt_result:2, error_code:'SERVICE_EXCEPTION'
                }, function(){}, function(){});
                errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB error when set epc_id'});
                app.STD_END();
            }
        );
    });

    app.fire(data, function(){});
};

Vm.prototype.console = function(data, callback, errorcallback){
    this.sendData('/v1/vms/'+data.uuid+'/console', 'post', '', function(sCode, data){
            callback(data);
        },
        errorcallback
    )
}


Vm.prototype.modify_charge_handler_to_bss = function() {
    var p = this;
    if (p.origin_template.vcpu_num != p.data.vcpu_num
       || p.origin_template.mem_size != p.data.mem_size
       || p.origin_template.user_disk_size != p.data.user_disk_size) {
        var condition = 'select useruuid from ?? where ??=?';
        var param = [];
        param.push('id');
        param.push(p.origin_template.userid);
        p.executeSql(condition)([Vm.prototype.user_tableName].concat(param),function(ans){
            if (ans != null && ans.length > 0) {
                var useruuid = ans[0].useruuid;
                var response = {OPT_STATUS: constr.OPT.SUCCESS, data:{}};
                var vm_charge = [{}];
                response.data.ORDER_ID = 0;
                response.session = p.origin_template.session;
                response.useruuid = ans[0].useruuid;
                response.domain = p.origin_template.domain;
                response.data.USERID = p.origin_template.userid;
                response.data.USERUUID = ans[0].useruuid;
                response.data.DOMAIN = p.origin_template.domain;
                vm_charge[0].PS_LCUUID = p.origin_template.product_specification_lcuuid;
                vm_charge[0].INSTANCE_LCUUID = p.origin_template.lcuuid;
                vm_charge[0].NAME = p.origin_template.name;
                vm_charge[0].CPU = p.data.vcpu_num;
                vm_charge[0].MEMORY = p.data.mem_size;
                vm_charge[0].DISK =  p.data.user_disk_size;
                vm_charge[0].MDF_FLAG = true;
                response.data.VMS = vm_charge;
                response.user_id = p.origin_template.userid;
                response.autoconfirm = 1;
                response.isconfirmed = 2;
                var content_from = 'cpu:' + p.origin_template.vcpu_num + ',mem:' + p.origin_template.mem_size + ',user_disk:'+ p.origin_template.user_disk_size;
                var content_to = 'cpu:' + p.data.vcpu_num + ',mem:' + p.data.mem_size + ',user_disk:'+ p.data.user_disk_size;
                response.content = JSON.stringify({vm:['modify vm '+ p.data.name + ' from ' + content_from + ' to '+ content_to]});
                response.data = JSON.stringify(response.data);
                p.callbackWeb('/order/addorder', 'post', response, function(resp){
                    logger.info(resp);
                    logger.info('vm modify insert into order success')
                },function() {
                    logger.error('vm modify insert into order failed');
                });
        }
    },function(a){errorcallback(a)});
  } else if (p.origin_template.name != p.data.name) {
       var charge_name = {};
       charge_name.OBJ_LCUUID = p.origin_template.lcuuid;
       charge_name.NEW_INSTANCE_NAME = p.data.name;
       p.callCharge('/charge-names', 'post', charge_name, function(resp){
           logger.debug('modify charge name success');
       },function() {
           logger.debug('modify charge name failed');
       });
  }
}

Vm.prototype.stop_charge_handler_to_bss = function(data) {
    var p = this;
    var type = 'vms';
    if ('role' in p.data) {
        if (p.data.role == 2) {
            type = 'lbs';
        } else if (p.data.role == 6) {
            type = 'vfws';
        }
    }
    var condition = 'select useruuid from ?? where ??=?';
    var param = [];
    param.push('id');
    param.push(p.data.userid);
    p.executeSql(condition)([Vm.prototype.user_tableName].concat(param),function(ans){
        if (ans != null && ans.length > 0) {
            var useruuid = ans[0].useruuid;
            p.callCharge('/charges/?DOMAIN=' + p.data.domain +'&TYPE=' + type + '&LCUUID=' + p.data.lcuuid + '&USERUUID=' + useruuid, 'delete',{},function(resp){
                logger.debug('del vm charge record success');
            },function() {
                logger.debug('del vm charge record failed');
            });
        }
    },function(a){errorcallback(a)});
}

Vm.prototype.putinterface = function(data, callback, errorcallback){
    var p = this;
    var bdbdata = JSON.parse(JSON.stringify(data).toUpperCase());
    var body = {'userid':0,
                'isp':0,
                'bandw':0,
                'type':"VM",
                'lcuuid':""};
    var app = new flow.serial([
        function(a, f) {
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(vmans) {
                    if (vmans.length > 0){
                        data.lcuuid = vmans[0].lcuuid;
                        data.userid = vmans[0].userid;
                        body.userid = vmans[0].userid;
                        body.lcuuid = vmans[0].lcuuid;
                        if ('ID' in bdbdata) {
                            delete bdbdata['ID'];
                        }
                        if ('IFINDEX' in bdbdata) {
                            delete bdbdata['IFINDEX'];
                        }
                        if ('OPERATOR_NAME' in bdbdata) {
                            delete bdbdata['OPERATOR_NAME'];
                        }
                        f(a);
                    } else{
                        errorcallback(404);
                        app.STD_END();
                    }
                },
                function(a){errorcallback(a), app.STD_END()}
            );
        },
        function(a, f) {
            if (data.if_type == 'WAN' && data.state == 1 && data.wan.ips.length) {
                body.bandw = data.wan.qos.max_bandwidth;
                p.selectSql(
                    [p.iptableName, 'lcuuid', data.wan.ips[0].ip_resource_lcuuid],
                    function(ans){
                        if (ans.length > 0) {
                            body.isp = ans[0].isp;
                            f(a);
                        } else {
                            errorcallback(404);
                            app.STD_END();
                        }
                    },
                    function(a){errorcallback(a), app.STD_END()}
                );
            } else {
                f(a);
            }
        }
    ]);
    if (data.if_type == 'WAN' && data.state == 1 && data.wan.ips.length) {
        lc_utils.checkbandwidth_v2(body, errorcallback, app, p);
    }
    app.list.push(function(a, f) {
        p.sendData('/v1/vms/'+data.lcuuid+'/interfaces/'+data.ifindex, 'put', bdbdata, function(sCode, rdata) {
            if (sCode != 200){
                errorcallback(sCode);
            } else {
                if (rdata.OPT_STATUS == 'SUCCESS') {
                    callback(rdata);
                    p.sendToMsgCenter({type:'user', target:data.userid, msg:{action:'putinterface', state:'done', type:'vm', id:data.id}});
                    operationLog.create_and_update(
                        {operation:'putinterface', objecttype:'vm', objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:1},
                        function(){},
                        function(){});
                } else {
                    operationLog.create_and_update(
                        {operation:'put_interface', objecttype:'vm', objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    callback(rdata);
                }
            }
        },
        errorcallback
        )
    });

    app.fire('', function(){logger.info('putinterface done')});
}

Vm.prototype.modifyinterface = function(data, callback, errorcallback){
    var p = this;
    var bdbdata = lc_utils.upperJsonKey(data);
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var data_req = data.interfaces;
    var body = {'userid':0, 'isp':0, 'bandw':0, 'type':"VM", 'lcuuid':""};

    flow_steps.push(function(a, f){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(vmans) {
                if (vmans.length > 0){
                    data.lcuuid = vmans[0].lcuuid;
                    data.userid = vmans[0].userid;
                    body.userid = vmans[0].userid;
                    body.lcuuid = vmans[0].lcuuid;
                    if ('ID' in bdbdata) {
                        delete bdbdata['ID'];
                    }
                    if ('OPERATOR_NAME' in bdbdata) {
                        delete bdbdata['OPERATOR_NAME'];
                    }
                    if ('ACTION' in bdbdata) {
                        delete bdbdata['ACTION'];
                    }
                    f(a);
                } else{
                    errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION:'vm not found'});
                    app.STD_END();
                }
            },
            function(a){errorcallback(a, {OPT_STATUS: constr.OPT.FAIL, DESCRIPTION:'query vm error'}), app.STD_END()}
        );
    });

    for (var i = 0; i < data_req.length; i++) {
        (function(i){
        if (data_req[i].if_type == 'WAN' && data_req[i].state == 1 && data_req[i].wan.ips.length) {
            flow_steps.push(function(a, f){
                body.bandw = data_req[i].wan.qos.max_bandwidth;
                p.selectSql(
                    [p.iptableName, 'lcuuid', data_req[i].wan.ips[0].ip_resource_lcuuid],
                    function(ans){
                        if (ans.length > 0) {
                            body.isp = ans[0].isp;
                            f(a);
                        } else {
                            errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION:'ip_resource not found'});
                            app.STD_END();
                        }
                    },
                    function(a){errorcallback(a, {OPT_STATUS: constr.OPT.FAIL, DESCRIPTION:'query ip_resource error'}), app.STD_END()}
                );
            });
            lc_utils.checkbandwidth_v2(body, errorcallback, app, p);
        }
        })(i)
    }


    if (0 == data_req.length) {
        flow_steps.push(function(a, f){
            p.sendData('/v1/vms/' + data.lcuuid, 'get', '',
                function(sCode, rdata) {
                    if (rdata.OPT_STATUS == 'SUCCESS'){
                        vm_data = rdata.DATA;
                        for (var i = 0; i < vm_data.INTERFACES.length; i++) {
                            bdbdata.INTERFACES[i] = {}
                            if (vm_data.INTERFACES[i].IF_TYPE == 'SERVICE' ||
                                vm_data.INTERFACES[i].IF_TYPE == 'CONTROL') {
                                bdbdata.INTERFACES[i].IF_TYPE = vm_data.INTERFACES[i].IF_TYPE;
                                bdbdata.INTERFACES[i].STATE = vm_data.INTERFACES[i].STATE;
                                bdbdata.INTERFACES[i].IF_INDEX = vm_data.INTERFACES[i].IF_INDEX;
                            } else {
                                bdbdata.INTERFACES[i] = vm_data.INTERFACES[i];
                            }
                        }
                        f(a);
                    } else{
                        errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION:'vm not found'});
                        app.STD_END();
                    }
                },
                function(a){errorcallback(a, {OPT_STATUS: constr.OPT.FAIL, DESCRIPTION:'get vm error'}), app.STD_END()}
            )
        });
    }

    var clearVifMsSteps = [];
    flow_steps.push(function(a, f){
        bdbdata.INTERFACES.forEach(function(vif){
            clearVifMsSteps.push(function(a, f){
                ms.clearVifMs({lcuuid: data.lcuuid, if_index: vif.IF_INDEX}, f).resolve();
            })
        })
        f();
    })

    flow_steps.push(clearVifMsSteps);

    flow_steps.push(function(a, f){
        logger.info('check vifs ans:', a)
        var check = true;
        a.some(function(val){
            if (val === true)
                return false;
            if (typeof val == 'object'){
                check = val;
            } else {
                check = false;
            }
            return true;
        })
        if (check === true){
            f()
        } else {
            if (typeof check === 'object'){
                errorcallback(check.code, check.body);
            } else {
                errorcallback(400, {OPT_STATUS: constr.OPT.VIF_IS_IN_FLOW});
            }
            app.STD_END();
        }
    })

    flow_steps.push(function(a, f){
        //check
        p.sendData('/v1/vms/'+data.lcuuid, 'patch', bdbdata, function(sCode, rdata) {
            if (sCode != 200){
                errorcallback(sCode);
            } else {
                if (rdata.OPT_STATUS == 'SUCCESS') {
                    callback(rdata);
                    p.sendToMsgCenter({type:'user', target:data.userid, msg:{action:'modifyinterface', state:'done', type:'vm', id:data.id}});
                    operationLog.create_and_update(
                        {operation:'modifyinterface', objecttype:'vm', objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:1},
                        function(){},
                        function(){});
                } else {
                    operationLog.create_and_update(
                        {operation:'modifyinterface', objecttype:'vm', objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    callback(rdata);
                }
            }
        },
        errorcallback
        )
    });

    app.fire('', function(){logger.info('modifyinterface done')});
}

Vm.prototype.default_event_parser = function(data, callback, errorcallback){
    logger.info("11111111111111111111111111111111111111111111111");
    logger.info("22222222222222", data);
    var p = this;
    //translate isolation, snapshot to db,
    if (data.state == p.state.DELETED){
        p.sendToMsgCenter({type:'user', target:data.userid, msg:{action:'delete', state:'done', type:'vm', id:data.id, data:data}});
        p.selectSql(
            [p.tableName, 'lcuuid', data.lcuuid],
            function(ans) {
                if (ans.length > 0){
                    for (var i = 0; i < p.snapshots.length; i++) {
                        p.stop_snapshot_charge_handler({lcuuid:p.snapshots[i],
                                                        userid:ans[0].userid,
                                                        domain:ans[0].domain})
                    }
                } else {
                    logger.error('Cannot find vm: %s', data.lcuuid);
                }
            },
            function() {
                logger.error('DB Error when lookup vm: %s', data.lcuuid);
            }
        )
        p.deleteSql([this.tableName, 'lcuuid', data.lcuuid],
                    function(ans) {
                        p.stop_charge_handler_to_bss(data, errorcallback);
                        callback(ans);
                    },
                    function() {
                        p.writeToSql(callback, errorcallback, true);
                    });
        p.deleteSql([this.vul_scanner_tableName, 'vm_lcuuid', data.lcuuid],
                    function(ans) {
                        logger.debug('delete vul_scanner item succeed')
                    },
                    function() {
                        logger.error('delete vul_scanner item failed')
                    });
    } else if (p.action == 'snapshot' || p.action == 'delsnapshot' || p.action == 'recoversnapshot') {
        if ('snapshot_lcuuid' in p.data_diff) {
            delete p.data_diff['snapshot_lcuuid'];
        }
        if ('snapshot_name' in p.data_diff) {
            delete p.data_diff['snapshot_name'];
        }
        if ('snapshot_size' in p.data_diff) {
            delete p.data_diff['snapshot_size'];
        }
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans){
                if (ans.length > 0){
                    data.lcuuid = ans[0].lcuuid;
                    data.userid = ans[0].userid;
                    p.updateSql(
                        [p.tableName, p.data_diff, 'id', data.id],
                        function(){
                            logger.debug('data_diff stored to sql');
                            if (data.snapshotstate == p.state.SNAPSHOT_DELETED) {
                                p.stop_snapshot_charge_handler({lcuuid:p.data.snapshot_lcuuid,
                                                                userid:ans[0].userid,
                                                                domain:ans[0].domain});
                            } else if (p.action == 'recoversnapshot' &&
                                       data.snapshotstate == p.state.SNAPSHOT_CREATED) {
                                p.getSession(
                                    ans[0].userid,
                                    function(user){
                                        if (user != null && user.length > 0) {
                                            p.origin_template = {};
                                            p.origin_template.session = user[0].session;
                                            p.origin_template.lcuuid = ans[0].lcuuid;
                                            p.origin_template.product_specification_lcuuid =
                                                ans[0].product_specification_lcuuid;
                                            p.origin_template.vcpu_num = ans[0].vcpu_num;
                                            p.origin_template.mem_size = ans[0].mem_size;
                                            p.origin_template.user_disk_size = ans[0].user_disk_size;
                                            p.origin_template.domain = ans[0].domain;
                                            p.origin_template.userid = ans[0].userid;
                                            p.origin_template.name = ans[0].name;
                                            p.data.name = ans[0].name;
                                            p.modify_charge_handler_to_bss();
                                        } else {
                                            logger.info('revert snapshot get session failed.');
                                        }
                                    },
                                    function(){logger.info('revert snapshot get session error.');}
                                );
                            } else if (p.action == 'snapshot' && data.snapshotstate == p.state.SNAPSHOT_CREATED) {
                                    p.selectSql([p.snapshot_tableName, 'lcuuid', data.snapshot_lcuuid],
                                    function(ans){
                                        if (ans.length > 0){
                                            var response = {opt_status: constr.OPT.SUCCESS, data:{}};
                                            var snapshot_charge = [{}];
                                            response.user_id = ans[0].userid;
                                            response.domain = ans[0].domain;
                                            response.autoconfirm = 1;
                                            response.isconfirmed = 2;
                                            response.content =  JSON.stringify({snapshot:[{vm_name:ans[0].name,
                                                                                           name:p.data.snapshot_name,
                                                                                           size:p.data.snapshot_size,
                                                                                           lcuuid:p.data.snapshot_lcuuid}]});

                                            response.data.ORDER_ID = 0;
                                            response.data.USERID = ans[0].userid;
                                            response.data.DOMAIN = ans[0].domain;
                                            snapshot_charge[0].OBJ_LCUUID = ans[0].lcuuid;
                                            snapshot_charge[0].INSTANCE_LCUUID = ans[0].vm_lcuuid;
                                            snapshot_charge[0].SIZE = ans[0].size;
                                            snapshot_charge[0].PS_LCUUID = ans[0].product_specification_lcuuid;
                                            snapshot_charge[0].NAME = ans[0].name;
                                            snapshot_charge[0].MDF_FLAG = false;
                                            response.data.SNAPSHOTS = snapshot_charge;

                                            p.getSession(ans[0].userid, function(user){
                                                if (user != null && user.length > 0) {
                                                    response.session = user[0].session;
                                                    response.data.USERUUID = user[0].useruuid;
                                                    response.useruuid = user[0].useruuid;
                                                    response.data = JSON.stringify(response.data);
                                                    p.callbackWeb('/order/addorder', 'post',response, function(sCode,order_data){
                                                        if (sCode == 200){
                                                            logger.info('Insert snapshot order success');
                                                            callback({OPT_STATUS: 'SUCCESS'});
                                                        } else {
                                                            logger.info('Insert snapshot order failed');
                                                            errorcallback(sCode);
                                                        }
                                                    });
                                                 }
                                           },function(){logger.info('snapshot get session failed.');});
                                        }
                                    });
                            }
                        },
                        function() {
                            logger.error('data_diff stored to sql failed');
                        }
                    );
                    var action_status = p.getActionStatus(p.data_diff);
                    p.sendToMsgCenter({type:'user', target:data.userid,
                                       msg:{action:p.action, state:action_status, type:'vm', id:data.id, data:p.data_diff}});
                } else {
                    logger.error('Cannot find vm: %d', data.id);
                }
                callback();
            },
            function() {
                logger.error('DB Error when lookup vm: %d', data.id);
                callback();
            }
        )
    } else {
        logger.info("3333333333333333333333333333333333");
        p.writeToSql(callback, errorcallback);
    }
}

Vm.prototype.stop_snapshot_charge_handler = function(data) {
    var p = this;
    var type = 'snapshots';
    var condition = 'select useruuid from ?? where ??=?';
    var param = [];
    param.push('id');
    param.push(data.userid);
    logger.info("domain: ", data.domain);
    p.executeSql(condition)([Vm.prototype.user_tableName].concat(param),function(ans){
        if (ans != null && ans.length > 0) {
            var useruuid = ans[0].useruuid;
            p.callCharge('/charges/?DOMAIN=' + data.domain +'&TYPE=' + type + '&LCUUID=' + data.lcuuid + '&USERUUID=' + useruuid, 'delete',{},function(resp){
                logger.debug('del snapshot charge record success');
            },function() {
                logger.debug('del snapshot charge record failed');
            });
        }
    },function(a){errorcallback(a)});
}

Vm.prototype.check = function(e){
    return true;
}

//a.update({id:1004, name:'fsd'}, console.log, console.log);
module.exports=Vm;
