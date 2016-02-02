var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var uuid = require('node-uuid');
var Vm = require('./vm.js');
var Isp = require('./isp.js');
var Epc = require('./epc.js');
var Vl2 = require('./vl2.js');
var user = require('./user.js');
var operationLog = require('./operation_log.js');
var Cashier = require('./cashier.js');
var constr = require('./const.js');
var Domain = require('./domain.js')

var LB = function() {
    Obj.call(this);
    this.tableCols = [ 'id', 'lcuuid', 'path', 'userid', 'state' , 'domain' ];
}
util.inherits(LB, Obj);

LB.prototype.tableName = 'fdb_vm_v2_2';
LB.prototype.promotion_rules_detail_tableName = 'promotion_rules_detail';

LB.prototype.get_lbs = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var ip_response = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var fdb_vms = new Map();
    var response;
    var userid;

    var condition = 'select * from ?? where true and role=\'2\' ';
    var param = [];

    if ('order_id' in data) {
        condition += ' and ??=?';
        param.push('order_id');
        param.push(data.order_id);
    }else if  ('lcuuid' in data) {
        condition += ' and ??=?';
        param.push('lcuuid');
        param.push(data.lcuuid);
    }else if  ('epc_id' in data) {
        condition += ' and ??=?';
        param.push('epc_id');
        param.push(data.epc_id);
    }

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            [LB.prototype.tableName].concat(param),
            function(ans){
                if (ans.length > 0) {
                    userid = ans[0].userid;
                    for (var i=0; i<ans.length; i++){
                        fdb_vms.put(ans[i].lcuuid,ans[i]);
                    }
                    f(a);
                 } else {
                     errorcallback(200, {OPT_STATUS: 'SUCCESS',DATA:[],TYPE:'lb',WAIT_CALLBACK:false});
                     app.STD_END();
                 }
            },errorcallback)}
        );
    flow_steps.push(function(a, f){
        var lcuuid = '';
        var filter = {};
        if ('state' in data) {
            filter.state = data.state;
        }
        if ('userid' in data) {
            filter.userid = data.userid;
        }
        if ('domain' in data) {
            filter.domain = data.domain;
        }
        if ('lcuuid' in data) {
            lcuuid = '/' + data.lcuuid;
            filter = {};
        }
        p.sendData('/v1/lbs' + lcuuid , 'get', filter, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                if (rdata.DATA instanceof Array) {
                         var index = 0;
                         var rdata_index = [] ;
                         for (var i= 0;i<rdata.DATA.length;i++) {
                             if(!fdb_vms.get(rdata.DATA[i].LCUUID)){
                                 rdata_index [index]=i;
                                 index ++;
                             }else{
                                 rdata.DATA[i].CREATE_TIME = fdb_vms.get(rdata.DATA[i].LCUUID).create_time.toMysqlFormat();
                                 rdata.DATA[i].EPC_ID = fdb_vms.get(rdata.DATA[i].LCUUID).epc_id;
                                 rdata.DATA[i].STATE = fdb_vms.get(rdata.DATA[i].LCUUID).state;
                                 rdata.DATA[i].PRODUCT_SPECIFICATION_LCUUID =
                                     fdb_vms.get(rdata.DATA[i].LCUUID).product_specification_lcuuid;
                             }
                         }
                         if(rdata_index.length !=0){
                             for (var i = rdata_index.length - 1; i >= 0; --i){
                                 rdata.DATA.splice(rdata_index[i], 1);
                             }
                         }
                     }else{
                         rdata.DATA.CREATE_TIME = fdb_vms.get(rdata.DATA.LCUUID).create_time.toMysqlFormat();
                         rdata.DATA.EPC_ID = fdb_vms.get(rdata.DATA.LCUUID).epc_id;
                         rdata.DATA.STATE = fdb_vms.get(rdata.DATA.LCUUID).state;
                         rdata.DATA.PRODUCT_SPECIFICATION_LCUUID =
                             fdb_vms.get(rdata.DATA.LCUUID).product_specification_lcuuid;
                     }
                response= rdata;
            }
            f(response.DATA);
        },errorcallback);
    });

    flow_steps.push(function(a, f){
        var filter = {};
        var isp = new Isp();
        var i;
        if ('userid' in data) {
            filter.userid = userid;
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


LB.prototype.get_lbs_listeners = function(data, callback, errorcallback) {
    var p = this;
    var lb_lcuuid = '';
    if ('lb-lcuuid' in data) {
        lb_lcuuid = data['lb-lcuuid'];
    }

    p.sendData('/v1/lbs/' + lb_lcuuid + '/lb-listeners', 'get', {},
        function(sCode, rdata) {callback(rdata);
    }, errorcallback);
}

LB.prototype.get_lbs_listeners_lb_bk_vms = function(data, callback, errorcallback) {
    var p = this;
    var filter = {};
    var lb_lcuuid = '';
    var lb_listener_lcuuid = '';
    var lcuuid = '';
    if ('lb-lcuuid' in data) {
        lb_lcuuid = data['lb-lcuuid'];
    }
    if ('lb-listener-lcuuid' in data) {
        lb_listener_lcuuid = data['lb-listener-lcuuid'];
    }
    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    p.sendData("/v1/lbs/" + lb_lcuuid + "/lb-listeners/" + lb_listener_lcuuid + "/lb-bk-vms/" + lcuuid, 'get', {},
        function(sCode, rdata) {callback(rdata);
    }, errorcallback);
}

LB.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    p.selectSql([p.tableName, 'id', data.id],function(vmans) {
        if (vmans.length > 0){
            data.lcuuid = vmans[0].lcuuid;
            data.USERID = vmans[0].userid;
            data.product_specification_lcuuid = vmans[0].product_specification_lcuuid;
            data.DOMAIN = vmans[0].domain;
            p.data = data;
            data.PRODUCT_TYPE = 'load-balancer';

            p.start_charge_handler(function(){
                res_data = {};
                res_data.OPT_STATUS = 'SUCCESS';
                res_data.DESCRIPTION = '';
                callback(res_data);
            }, errorcallback);
        } else{
            errorcallback(404);
        }
    },errorcallback);
}

LB.prototype.start_charge_handler = function(callback, errorcallback) {
    var p = this;
    var cashierCallback = function(rdata){
        var filter = {};
        if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
            filter.CHARGE_MODE = rdata.DATA.CHARGE_MODE;
            filter.PRICE = rdata.DATA.PRICE;
            filter.PRESENT_DAYS = rdata.DATA.USER_PRICE_DAYS;
            filter.PRICE_QUANTITY = rdata.DATA.USER_PRICE_QUANTIY;
        }else{
            errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get charge_mode and price is not specified'});
            return;
        }
        p.sendData('/v1/charges/lbs/' + p.data.lcuuid,'post',filter,function(sCode, data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                if(rdata.DATA.RULE_FLAG && rdata.DATA.USER_PRICE_DAYS > 0){
                    var condition_insert = "INSERT INTO ?? (promotion_rules_id,object_type,object_lcuuid,present_days,present_quantity,userid)values(?,?,?,?,?,?);";
                    var param_insert = [LB.prototype.promotion_rules_detail_tableName];
                    param_insert.push(rdata.DATA.PROMOTION_RULES_ID);
                    param_insert.push('load-balancer');
                    param_insert.push(p.data.lcuuid);
                    param_insert.push(rdata.DATA.USER_PRICE_DAYS);
                    param_insert.push(rdata.DATA.USER_PRESENT_QUANTIY);
                    param_insert.push(p.data.USERID);
                    p.executeSql(condition_insert)(param_insert, function(rdata){},errorcallback);
                }
                logger.debug('add lb charge record success');
                callback();
            } else {
                logger.debug('add lb charge record failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add lb charge record failed'});
            }
        },
        function() {
            logger.error('add lb charge request failed');
            errorcallback(500, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add lb charge record failed'});
        });
    }

    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);
}

LB.prototype.lbs_create_listeners = function(data, callback, errorcallback) {
    var p = this;
    var lb_lcuuid = '';
    var operator_name = '';
    if ('lb_lcuuid' in data) {
        lb_lcuuid = data.lb_lcuuid;
    }
    if ('operator_name' in data) {
        operator_name = data['operator_name'];
        delete data['operator_name'];
    }
    delete data['lb_lcuuid'];
    p.sendData('/v1/lbs/' + lb_lcuuid + '/lb-listeners', 'post', data,function(sCode,rdata) {
        p.sendData('/v1/lbs/' + lb_lcuuid , 'get', {}, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                operationLog.create_and_update({operation:'create', objecttype:'lb', objectid:rdata.DATA.ID,
                             object_userid:rdata.DATA.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});  
            }
        },errorcallback);
        callback(rdata);
    }, errorcallback);
}

LB.prototype.lbs_modify_listeners = function(data, callback, errorcallback) {
    var p = this;
    var lb_lcuuid = '';
    var lcuuid = '';
    var operator_name = '';
    if ('lb_lcuuid' in data) {
        lb_lcuuid = data.lb_lcuuid;
    }
    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    if ('operator_name' in data) {
        operator_name = data['operator_name'];
        delete data['operator_name'];
    }
    delete data['lb_lcuuid'];
    delete data['lcuuid'];
    p.sendData('/v1/lbs/' + lb_lcuuid + '/lb-listeners/' + lcuuid, 'put', data,function(sCode, rdata) {
        p.sendData('/v1/lbs/' + lb_lcuuid , 'get', {}, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                operationLog.create_and_update({operation:'create', objecttype:'lb', objectid:rdata.DATA.ID,
                             object_userid:rdata.DATA.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});  
            }
        },errorcallback);
        callback(rdata);
    }, errorcallback);
}

LB.prototype.lbs_delete_listeners = function(data, callback, errorcallback) {
    var p = this;
    var lb_lcuuid = '';
    var lcuuid = '';
    var operator_name = '';
    if ('lb-lcuuid' in data) {
        lb_lcuuid = data['lb-lcuuid'];
    }
    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    if ('operator_name' in data) {
        operator_name = data['operator_name'];
        delete data['operator_name'];
    }
    p.sendData('/v1/lbs/' + lb_lcuuid + '/lb-listeners/' + lcuuid, 'delete', {},function(sCode, rdata) {
        p.sendData('/v1/lbs/' + lb_lcuuid , 'get', {}, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                operationLog.create_and_update({operation:'create', objecttype:'lb', objectid:rdata.DATA.ID,
                             object_userid:rdata.DATA.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});  
            }
        },errorcallback);
        callback(rdata);
    }, errorcallback);
}

LB.prototype.lbs_modify_bk_vms = function(data, callback, errorcallback) {
    var p = this;
    var lb_lcuuid = '';
    var lb_listener_lcuuid = '';
    var lcuuid = '';
    if ('lb_lcuuid' in data) {
        lb_lcuuid = data.lb_lcuuid;
    }
    if ('lb_listener_lcuuid' in data) {
        lb_listener_lcuuid = data.lb_listener_lcuuid;
    }
    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    delete data['operator_name'];
    delete data['lb_lcuuid'];
    delete data['lb_listener_lcuuid'];
    delete data['lcuuid'];
    p.sendData('/v1/lbs/' + lb_lcuuid + '/lb-listeners/' + lb_listener_lcuuid + '/lb-bk-vms/' + lcuuid,'patch', data,
        function(sCode, rdata) {
        p.sendData('/v1/lbs/' + lb_lcuuid , 'get', {}, function(sCode, rdata){
            if (rdata.OPT_STATUS == 'SUCCESS') {
                operationLog.create_and_update({operation:'create', objecttype:'lb', objectid:rdata.DATA.ID,
                             object_userid:rdata.DATA.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});  
            }
        },errorcallback);
        callback(rdata);
    }, errorcallback);
}

LB.prototype.create_lb_cluster = function(data, callback, errorcallback) {
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var vifs_data = {}
    var interface_num = 5;
    var req_body = {};
    var response = {};

    flow_steps.push(function(a, f){
        p.sendData('/v1/vms/' + data.MASTER_LB_LCUUID, 'get', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    data.userid = resp.DATA.USERID;
                    data.id = resp.DATA.ID;
                    f(a);
                } else {
                    logger.info('Get LB ', data.MASTER_LB_LCUUID, ' failed');
                    response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                    response.DESCRIPTION = "Master LB not found";
                    errorcallback(404, response);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('Get LB ', data.MASTER_LB_LCUUID, ' failed');
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when get master lb";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        vifs_data.GATEWAY = '0.0.0.0';
        vifs_data.INTERFACES = [];
        for (var i = 0; i < interface_num; i++) {
            vifs_data.INTERFACES[i] = {};
            vifs_data.INTERFACES[i].STATE = 2;
            vifs_data.INTERFACES[i].IF_INDEX = i;
        }
        p.sendData('/v1/vms/' + data.BACKUP_LB_LCUUID, 'patch', vifs_data,
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    f(a);
                } else {
                    logger.info('Detach LB ', data.BACKUP_LB_LCUUID, 'interfaces failed');
                    operationLog.create_and_update(
                        {operation:'create_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error detach lb ', data.BACKUP_LB_LCUUID, ' interfaces');
                operationLog.create_and_update(
                    {operation:'create_ha_cluster', objecttype:'lb',
                     objectid:data.id, object_userid:data.userid,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){},
                    function(){});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when detach lb interfaces";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        req_body.MASTER_LB_LCUUID = data.MASTER_LB_LCUUID;
        req_body.BACKUP_LB_LCUUID = data.BACKUP_LB_LCUUID;
        p.sendData('/v1/lb-clusters', 'post', req_body,
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    operationLog.create_and_update(
                        {operation:'create_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:1},
                         function(){},
                         function(){});
                    callback(resp);
                } else {
                    logger.info('Create LB ', data.MASTER_LB_LCUUID, 'cluster failed');
                    operationLog.create_and_update(
                        {operation:'create_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error create LB ', data.MASTER_LB_LCUUID, ' cluster');
                operationLog.create_and_update(
                    {operation:'create_ha_cluster', objecttype:'lb',
                     objectid:data.id, object_userid:data.userid,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){},
                    function(){});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when create lb ha cluster";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    app.fire('', function(){});
}

LB.prototype.delete_lb_cluster = function(data, callback, errorcallback) {
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var vifs_data = {}
    var interface_num = 5;
    var req_body = {};
    var response = {};

    flow_steps.push(function(a, f){
        p.sendData('/v1/lb-clusters/' + data.lb_cluster_lcuuid, 'get', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    for (var i = 0; i < resp.DATA.LBS.length; i++) {
                        if (resp.DATA.LBS[i].HASTATE == 'MASTER') {
                            data.MASTER_LB_LCUUID = resp.DATA.LBS[i].LCUUID;
                        } else if (resp.DATA.LBS[i].HASTATE == 'BACKUP') {
                            data.BACKUP_LB_LCUUID = resp.DATA.LBS[i].LCUUID;
                        }
                    }
                    f(a);
                } else {
                    logger.info('Get Lb-Cluster ', data.lb_cluster_lcuuid, ' failed');
                    response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                    response.DESCRIPTION = "Lb-Cluster not found";
                    errorcallback(404, response);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('Get Lb-Cluster ', data.lb_cluster_lcuuid, ' failed');
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when get lb cluster";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        p.sendData('/v1/vms/' + data.MASTER_LB_LCUUID, 'get', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    data.userid = resp.DATA.USERID;
                    data.id = resp.DATA.ID;
                    f(a);
                } else {
                    logger.info('Get LB ', data.MASTER_LB_LCUUID, ' failed');
                    response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                    response.DESCRIPTION = "Master LB not found";
                    errorcallback(404, response);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('Get LB ', data.MASTER_LB_LCUUID, ' failed');
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when get master lb";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        vifs_data.GATEWAY = '0.0.0.0';
        vifs_data.INTERFACES = [];
        for (var i = 0; i < interface_num; i++) {
            vifs_data.INTERFACES[i] = {};
            vifs_data.INTERFACES[i].STATE = 2;
            vifs_data.INTERFACES[i].IF_INDEX = i;
        }
        p.sendData('/v1/vms/' + data.BACKUP_LB_LCUUID, 'patch', vifs_data,
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    f(a);
                } else {
                    logger.info('Detach LB ', data.BACKUP_LB_LCUUID, 'interfaces failed');
                    operationLog.create_and_update(
                        {operation:'delete_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error detach lb ', data.BACKUP_LB_LCUUID, ' interfaces');
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
                    response.DESCRIPTION = "API Error when detach lb interfaces";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        p.sendData('/v1/lb-clusters/' + data.lb_cluster_lcuuid, 'delete', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    operationLog.create_and_update(
                        {operation:'delete_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:1},
                         function(){},
                         function(){});
                    callback(resp);
                } else {
                    logger.info('Delete Lb-Cluster ', data.lb_cluster_lcuuid, ' failed');
                    operationLog.create_and_update(
                        {operation:'delete_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error Delete Lb-Cluster ', data.lb_cluster_lcuuid);
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
            }
        )
    })

    app.fire('', function(){});
}

LB.prototype.update_lb_cluster = function(data, callback, errorcallback) {
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var master_vifs_data = {}
    var master_listener_data = [];
    var vifs_data = {}
    var interface_num = 5;
    var req_body = {};
    var response = {};

    flow_steps.push(function(a, f){
        p.sendData('/v1/lbs/' + data.BACKUP_LB_LCUUID, 'get', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    data.userid = resp.DATA.USERID;
                    data.id = resp.DATA.ID;
                    master_vifs_data.GATEWAY = resp.DATA.GATEWAY;
                    master_vifs_data.LOOPBACK_IPS = resp.DATA.LOOPBACK_IPS;
                    master_vifs_data.INTERFACES = resp.DATA.INTERFACES;
                    master_listener_data = resp.DATA.LISTENERS;
                    f(a);
                } else {
                    logger.info('Get Backup LB ', data.BACKUP_LB_LCUUID, ' failed');
                    response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                    response.DESCRIPTION = "Backup LB not found";
                    errorcallback(404, response);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('Get Master LB ', data.BACKUP_LB_LCUUID, ' failed');
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when get master lb";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        vifs_data.GATEWAY = '0.0.0.0';
        vifs_data.INTERFACES = [];
        for (var i = 0; i < interface_num; i++) {
            vifs_data.INTERFACES[i] = {};
            vifs_data.INTERFACES[i].STATE = 2;
            vifs_data.INTERFACES[i].IF_INDEX = i;
        }
        p.sendData('/v1/vms/' + data.BACKUP_LB_LCUUID, 'patch', vifs_data,
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    f(a);
                } else {
                    logger.info('Detach LB ', data.BACKUP_LB_LCUUID, 'interfaces failed');
                    operationLog.create_and_update(
                        {operation:'update_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error detach lb ', data.BACKUP_LB_LCUUID, ' interfaces');
                operationLog.create_and_update(
                    {operation:'update_ha_cluster', objecttype:'lb',
                     objectid:data.id, object_userid:data.userid,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){},
                    function(){});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when detach lb interfaces";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        if (master_vifs_data.GATEWAY.length != 0) {
            vifs_data.GATEWAY = master_vifs_data.GATEWAY;
        } else {
            vifs_data.GATEWAY = '0.0.0.0';
        }
        vifs_data.LOOPBACK_IPS = master_vifs_data.LOOPBACK_IPS;
        vifs_data.INTERFACES = [];
        for (var i = 0; i < master_vifs_data.INTERFACES.length; i++) {
            if (master_vifs_data.INTERFACES[i].IF_TYPE == 'CONTROL') {
                continue;
            } else if (master_vifs_data.INTERFACES[i].IF_TYPE == 'SERVICE') {
                vifs_data.INTERFACES[i].IF_TYPE = master_vifs_data.INTERFACES[i].IF_TYPE;
                vifs_data.INTERFACES[i].STATE = master_vifs_data.INTERFACES[i].STATE;
                vifs_data.INTERFACES[i].IF_INDEX = master_vifs_data.INTERFACES[i].IF_INDEX;
            } else {
                vifs_data.INTERFACES[i] = master_vifs_data.INTERFACES[i];
            }
        }
        p.sendData('/v1/vms/' + data.MASTER_LB_LCUUID, 'patch', vifs_data,
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    f(a);
                } else {
                    logger.info('Attach LB ', data.MASTER_LB_LCUUID, 'interfaces failed');
                    operationLog.create_and_update(
                        {operation:'update_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error attach lb ', data.MASTER_LB_LCUUID, ' interfaces');
                operationLog.create_and_update(
                    {operation:'update_ha_cluster', objecttype:'lb',
                     objectid:data.id, object_userid:data.userid,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){},
                    function(){});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when attach lb interfaces";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f) {
        /* Wait VM VifConfig */
        setTimeout(function(){f(a);}, 2000);
    });

    flow_steps.push(function(a, f){
        req_body.MASTER_LB_LCUUID = data.MASTER_LB_LCUUID;
        p.sendData('/v1/lb-clusters/' + data.lb_cluster_lcuuid, 'patch', req_body,
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    operationLog.create_and_update(
                        {operation:'update_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:1},
                         function(){},
                         function(){});
                    callback(resp);
                } else {
                    logger.info('Update Lb-Cluster ', data.lb_cluster_lcuuid, 'failed');
                    operationLog.create_and_update(
                        {operation:'update_ha_cluster', objecttype:'lb',
                         objectid:data.id, object_userid:data.userid,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){},
                        function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('API Error update Lb-Cluster ', data.lb_cluster_lcuuid);
                operationLog.create_and_update(
                    {operation:'update_ha_cluster', objecttype:'lb',
                     objectid:data.id, object_userid:data.userid,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){},
                    function(){});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when update lb ha cluster";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    app.fire('', function(){});
}

LB.prototype.get_lb_clusters = function(data, callback, errorcallback){
    var p = this;
    var filter = {};
    var lcuuid = '';
    var response = {};

    if ('lcuuid' in data) {
        lcuuid = '/' + data.lcuuid;
    }
    p.sendData('/v1/lb-clusters' + lcuuid, 'get', filter,
        function(sCode, resp){
            callback(resp);
        },
        function(sCode, resp){
            try {
                response = JSON.parse(JSON.stringify(resp));
            } catch(e) {
                response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                response.DESCRIPTION = "API Error when get lb ha cluster";
            }
            errorcallback(sCode, response);
        }
    );
}

LB.prototype.create_lb_forward_rule = function(data, callback, errorcallback) {
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var response = {};
    var operator_name = '';

    if ('operator_name' in data) {
        operator_name = data['operator_name'];
        delete data['operator_name'];
    }
    logger.info(data);
    p.sendData('/v1/lb-forward-rules', 'post', data,
        function(sCode, resp) {
            if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                operationLog.create_and_update(
                    {operation:'create', objecttype:'lb_forward_rule',
                     name:data.NAME, object_userid:data.USERID,
                     operator_name:operator_name, opt_result:1},
                     function(){}, function(){});
                callback(resp);
            } else {
                logger.info('Create ForwardRule ', data.NAME, 'failed');
                operationLog.create_and_update(
                    {operation:'create', objecttype:'lb_forward_rule',
                     name:data.NAME, object_userid:data.USERID,
                     operator_name:operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){}, function(){});
                errorcallback(resp);
            }
        },
        function(sCode, resp){
            logger.info('Create ForwardRule ', data.NAME, 'failed');
            operationLog.create_and_update(
                {operation:'create', objecttype:'lb_forward_rule',
                 name:data.NAME, object_userid:data.USERID,
                 operator_name:operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                function(){}, function(){});
            try {
                response = JSON.parse(JSON.stringify(resp));
            } catch(e) {
                response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                response.DESCRIPTION = "API Error when create forward rule";
            }
            errorcallback(sCode, response);
        }
    )
}

LB.prototype.delete_lb_forward_rule = function(data, callback, errorcallback) {
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var response = {};

    flow_steps.push(function(a, f){
        p.sendData('/v1/lb-forward-rules/' + data.lcuuid, 'get', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    data.USERID = resp.DATA.USERID;
                    data.NAME = resp.DATA.NAME;
                    f(a);
                } else {
                    logger.info('Get ForwardRule ', data.lcuuid, ' failed');
                    response.OPT_STATUS = constr.OPT.RESOURCE_NOT_FOUND;
                    response.DESCRIPTION = "LB ForwardRule not found";
                    errorcallback(404, response);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('Get ForwardRule ', data.lcuuid, ' failed');
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when get forward rule";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    flow_steps.push(function(a, f){
        p.sendData('/v1/lb-forward-rules/' + data.lcuuid, 'delete', '',
            function(sCode, resp) {
                if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS'){
                    operationLog.create_and_update(
                        {operation:'delete', objecttype:'lb_forward_rule',
                         name:data.NAME, object_userid:data.USERID,
                         operator_name:data.operator_name, opt_result:1},
                         function(){}, function(){});
                    callback(resp);
                    f(a);
                } else {
                    logger.info('Delete ForwardRule ', data.NAME, 'failed');
                    operationLog.create_and_update(
                        {operation:'delete', objecttype:'lb_forward_rule',
                         name:data.NAME, object_userid:data.USERID,
                         operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                        function(){}, function(){});
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(sCode, resp){
                logger.info('Delete ForwardRule ', data.NAME, 'failed');
                operationLog.create_and_update(
                    {operation:'delete', objecttype:'lb_forward_rule',
                     name:data.NAME, object_userid:data.USERID,
                     operator_name:data.operator_name, opt_result:2, error_code:'SERVICE_EXCEPTION'},
                    function(){}, function(){});
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "API Error when delete forward rule";
                }
                errorcallback(sCode, response);
                app.STD_END();
            }
        )
    })

    app.fire('', function(){});
}

LB.prototype.get_lb_forward_rules = function(data, callback, errorcallback){
    var p = this;
    var filter = {};
    var lcuuid = '';
    var response = {};

    if ('lcuuid' in data) {
        lcuuid = '/' + data.lcuuid;
    }

    if ('userid' in data) {
        filter.userid = data.userid;
    }

    p.sendData('/v1/lb-forward-rules' + lcuuid, 'get', filter,
        function(sCode, resp){
            callback(resp);
        },
        function(sCode, resp){
            try {
                response = JSON.parse(JSON.stringify(resp));
            } catch(e) {
                response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                response.DESCRIPTION = "API Error when get forward rules";
            }
            errorcallback(sCode, response);
        }
    );
}

function Map(){
    this.container = new Object();
}

Map.prototype.put = function(key, value){
    this.container[key] = value;
}

Map.prototype.get = function(key){
    return this.container[key];
}

module.exports = LB;
