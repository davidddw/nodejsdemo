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
var lc_utils = require('./lc_utils.js');
var operationLog = require('./operation_log.js');
var constr = require('./const.js');
var user = require('./user.js');
var Cashier = require('./cashier.js');
var Domain = require('./domain.js')

var Valve = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'order_id',
        'epc_id',
        'state',
        'flag',
        'errno',
        'description',
        'poolid',
        'gw_pool_lcuuid',
        'userid',
        'gw_launch_server',
        'create_time',
        'lcuuid',
        'name',
        'type',
        'allocation_type',
        'domain',
        'product_specification_lcuuid',
        'operationid',
        'domain',
        'role',
    ];
}
util.inherits(Valve, Obj);
Valve.prototype.state = {
    TEMP : 0,
    CREATING : 1,
    CREATED : 2,
    ERROR : 3,
    MODIFYING : 4,
    DELETING : 5,
    STARTING : 6,
    RUNNING : 7,
    STOPPING : 8,
    STOP : 9,
    DELETED : 10,
};

Valve.prototype.getActionStatus = function(cur){
    if (this.action == 'create'){
        if (cur.state != this.state.TEMP){
            return 'done';
        } else{
            return 'failed';
        }
    }
    else if (this.action == 'delete'){
        return 'done';
    }
    else if (this.action == 'modify'){
        return 'done';
    }
    else if (this.action == 'update') {
        return 'done';
    }
}
Valve.prototype.flag = {
    ISOLATED : 0x4,
}
Valve.prototype.type = 'valve';
Valve.prototype.tableName = 'fdb_vgateway_v2_2';
Valve.prototype.fdb_user_tableName = 'fdb_user_v2_2';
Valve.prototype.iptableName = 'ip_resource_v2_2';
Valve.prototype.bwtableName = 'user_isp_bandwidth_v2_2';
Valve.prototype.viftableName = 'vinterface_v2_2';
Valve.prototype.product_spec_tableName = 'product_specification_v2_2';
Valve.prototype.pool_product_spec_tableName = 'pool_product_specification_v2_2';
Valve.prototype.constructor = Valve;
Valve.prototype.viftype = 5;
Valve.prototype.requiredApiData = {
    TYPE: 'type',
    ALLOC_TYPE: 'allocation_type',
    USERID: 'userid',
    NAME: 'name',
    DOMAIN: 'domain',
    PRODUCT_SPECIFICATION_LCUUID: 'product_specification_lcuuid'
};

Valve.prototype.checkApiCreateData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.NAME in data)) {
        errorcallback(400, {ERR_MSG:'name is not specified'});
        return false;
    }
    if (!(required.USERID in data)) {
        errorcallback(400, {ERR_MSG:'userid is not specified'});
        return false;
    }
    if (!(required.DOMAIN in data)) {
        errorcallback(400, {ERR_MSG:'domain is not specified'});
        return false;
    } if (!(required.ALLOC_TYPE in data)) { errorcallback(400, {ERR_MSG:'alloc_type is not specified'}); return false;
    }
    if (data.alloc_type == 'manual') {
        if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
            errorcallback(400, {ERR_MSG:'product_specification is not specified'});
            return false;
        }
        if (!(required.POOLID) in data) {
            errorcallback(400, {ERR_MSG:'poolid is not specified'});
            return false;
        }
        if (!(required.LAUNCH_SERVER in data)) {
            errorcallback(400, {ERR_MSG:'launch_server is not specified'});
            return false;
        }
    } else if (data.alloc_type == 'auto') {
        if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
            errorcallback(400, {ERR_MSG:'product_specification_lcuuid is not specified'});
            return false;
        }
    }
    return true;
}

Valve.prototype.parseUpdateApiToBdbData = function(data, callback, flag){
    var ans = [], res = [];
    //parse id to uuid
    var params = [];
    ans = data.data
    logger.info(params);
    new flow.parallel(params).fire('', function(){
        if (flag){
            //res = {ALLOCATION_TYPE:data.allocation_type.toUpperCase(),
            //       DATA:ans};
            res = ans;
        } else{
            logger.info(ans);
            // only update params
            if ('lcuuid' in ans)
                delete(ans.lcuuid);

            if ('id' in ans) {
                delete(ans.id);
            }

            res = lc_utils.upperJsonKey(ans);
        }
        logger.debug(res);
        callback(res)
    });
}

Valve.prototype.parseApiToBdbData = function(data, callback, flag){
    var ans = {}, res = {};
    var cols = this.tableCols, key='';
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[key] = data[key];
        } else if (cols[i] in data){
            ans[key] = data[cols[i]]
        }
    }
    delete ans['ALLOCATION_TYPE'];
    delete ans['ORDER_ID'];

    //parse id to uuid
    var params = [];
    var p = this;
    if ('PRODUCT_SPECIFICATION_LCUUID' in ans) {
        params.push(function(a, f) {
            p.selectSql([p.product_spec_tableName,
                         'lcuuid',
                         ans.PRODUCT_SPECIFICATION_LCUUID],
                function(data){
                    if (data.length > 0){
                        var specification = JSON.parse(data[0].content)
                        ans['WANS'] = specification.valve_info.wans;
                        ans['LANS'] = specification.valve_info.lans;
                        ans['IPS'] = specification.valve_info.ips;
                        ans['BW_WEIGHT'] = specification.valve_info.bw_weight;

                    } else {
                        logger.info('product_specification found no data of lcuuid',
                                    ans.PRODUCT_SPECIFICATION_LCUUID);
                        ans['WANS'] = 1;
                        ans['LANS'] = 1;
                    };
                    f(a);
                },
                function(){
                    ans['WANS'] = 1;
                    ans['LANS'] = 1;
                    f(a);
                }
            )
        });
    }
    new flow.parallel(params).fire('', function(){
        if (flag){
            //res = {ALLOCATION_TYPE:data.allocation_type.toUpperCase(),
            //       DATA:ans};
            res = ans;
        } else{
            logger.info(ans);
            // only update params
            if ('lcuuid' in ans)
                delete(ans.lcuuid);
            if ('WANS' in data) {
                ans['WANS'] = data['WANS']
            }
            if ('LANS' in data) {
                ans['LANS'] = data['LANS']
            }

            if ('ID' in ans) {
                delete(ans.ID);
            }
            res = ans;
        }
        if (data.allocation_type == 'auto') {
            logger.debug('allocation_type is auto');
        }
        logger.debug(res);
        callback(res)
    });
}

Valve.prototype.parseApiToFdbData = function(data){
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


Valve.prototype.writeToSql = function(callback, errorcallback, deleteflag){
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
                p.selectSql(
                    t,
                    function(ans){
                        if (ans.length > 0){
                            pre_data = ans[0];
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
                        logger.info
                    );
                }
            );
        } else{
            params.push(
                function(a, f){
                    p.deleteSql(
                        [p.tableName, 'id', p.data.id],
                        function(){logger.debug('valve deleted from sql'); f(a);},
                        logger.info
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
            var msg = {
                type:'user',
                target:pre_data.userid,
                msg:{
                    action:p.action,
                    state:action_status,
                    type:'valve',
                    id:pre_data.lcuuid,
                    data:{state:p.data.state}
                }
            };
            msg.msg.id = pre_data.id;
            p.sendToMsgCenter(msg);
            callback();
        })
        return;
    }
    logger.debug('data_diff is null, ignore writing to sql');
}


Valve.prototype.parseBdbsToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = {DATA:[], OPT_STATUS:data.OPT_STATUS};

    for(var j=0; j<data.DATA.length; j++){
        result.DATA.push(this.parseBdbToFdb(data.DATA[j]));
    }
    return result;
}
Valve.prototype.parseCallbackToFdb = function(data){
    return this.parseBdbToFdb(data);
}
Valve.prototype.parseBdbToFdb = function(data){
    logger.info(data);
    var cols = this.tableCols, key='';
    var ans = {};
    var p = this;
    if (data) {
        for (var i=0; i<cols.length; i++){
            key = cols[i].toUpperCase();
            if (key in data){
                ans[cols[i]] = data[key];
            } else if(cols[i] in data){
                ans[cols[i]] = data[cols[i]];
            }
        }
        if ('LCUUID' in data){
            ans['lcuuid'] = data.LCUUID;
        }

        if ('GW_LAUNCH_SERVER' in data) {
            ans['gw_launch_server'] = data.GW_LAUNCH_SERVER;
        }

        if ('GW_POOL_LCUUID' in data) {
            ans['gw_pool_lcuuid'] = data.GW_POOL_LCUUID;
        }
    }
    return ans;
}

Valve.prototype.parseBdbToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = util._extend({}, data);
    result.DATA = this.parseBdbToFdb(result.DATA);
    return result;
}

Valve.prototype.getFromBdb = function(uuid, callback, errorcallback){
    this.sendData('v1/valve/'+uuid, 'get', callback, errorcallback);
}

Valve.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(valves) {
            if (valves.length > 0){
                data.lcuuid = valves[0].lcuuid;
                data.product_specification_lcuuid = valves[0].product_specification_lcuuid;
                data.DOMAIN = valves[0].domain;
                p.data = data;
                data.PRODUCT_TYPE = 'valve';
                p.start_charge_handler(function(){
                    res_data = {};
                    res_data.OPT_STATUS = 'SUCCESS';
                    res_data.DESCRIPTION = '';
                    callback(res_data);
                }, errorcallback);
            } else{
                errorcallback(404, {ERR_MSG:'valve not found'});
            }
        },
        errorcallback
    );
}

Valve.prototype.start_charge_handler = function(callback,errorcallback) {
    var p = this;
    var cashierCallback = function(rdata){
        var filter = {};
        if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
            filter.CHARGE_MODE = rdata.DATA.CHARGE_MODE;
            filter.PRICE = rdata.DATA.PRICE;
        }else{
            errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get charge_mode and price is not specified'});
            return;
        }
        p.sendData('/v1/charges/valves/' + p.data.lcuuid,'post',filter,function(sCode, data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                logger.debug('add valve charge record success');
                callback();
            } else {
                logger.debug('add valve charge record failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add valve charge record failed'});
            }
        },
        function() {
            logger.error('add valve charge request failed');
            errorcallback(500, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add valve charge record failed'});
        });
    }

    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);

}


Valve.prototype.stop_charge_handler = function() {
    var p = this;
    var condition = 'select useruuid from ?? where ??=?';
    var param = [];
    param.push('id');
    param.push(p.data.userid);
    p.executeSql(condition)([Valve.prototype.fdb_user_tableName].concat(param),function(ans){
        if (ans != null && ans.length > 0) {
            var useruuid = ans[0].useruuid;
            p.callCharge('/charges/?DOMAIN=' + p.data.domain +'&TYPE=valves&LCUUID=' + p.data.lcuuid + '&USERUUID=' + useruuid, 'delete',{},function(resp){
                logger.debug('del valves charge record success');
            },function() {
                logger.debug('del valves charge record failed');
            });
        }
    },function(a){errorcallback(a);});
}


Valve.prototype.create = function(data, callback, errorcallback){
    var p = this;
    p.action = 'create';
    var check_res = p.checkApiCreateData(data, errorcallback);
    if (!check_res){
        logger.info('Create request check failed')
        return;
    }
    var order_id = data.order_id;
    var operator_name = data.operator_name;
    var fdbdata = p.parseApiToFdbData(data);
    fdbdata.create_time = new Date().toMysqlFormat();
    var next = function(bdbdata){
        p.insertSql(
            [p.tableName, fdbdata],
            function(ans){
                // bdbdata.DATA['LCID'] = ans.insertId;
                operationLog.create({operation:'create', objecttype:'valve', objectid:ans.insertId,
                    object_userid:fdbdata.userid, operator_name:operator_name});
                p.sendData('/v1/valves', 'post', bdbdata, function(sCode, data){
                    logger.info('remote server res :', data);
                    // app now handles  only one valve res in one request
                    var res_data = p.parseBdbToFdbData(data);
                    res_data.DATA['id'] = ans.insertId;
                    var newdata = res_data.DATA;
                    if (res_data.OPT_STATUS != 'SUCCESS' || res_data.DATA.length==0 || newdata.errno) {
                        operationLog.update({objecttype:'valve', objectid:ans.insertId,
                            opt_result:2, error_code:'SERVICE_EXCEPTION'});
                        errorcallback(500, {ERR_MSG:'create vgws error'});
                    }
                    p.sendToMsgCenter({type:'user',target:fdbdata.userid,
                        msg:{action:p.action, state:'done', type:'valve', id:ans.insertId,
                        data:{order_id:order_id}}});
                    p.updateSql([p.tableName, newdata, 'id', ans.insertId],
                        function(){
                            callback(lc_utils.upperJsonKey(res_data));
                            p.setData(newdata);
                        },errorcallback
                    );
                });
            },errorcallback
            );
    }
    p.parseApiToBdbData(data, next, true);
}

Valve.prototype.update = function(data, callback, errorcallback){
    var p = this;
    var operator_name = data.operator_name;
    p.action = 'update';
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var userid = 0;
    var lcuuid;
    var fdbdata = p.parseApiToFdbData(data);
    if ('lcuuid' in fdbdata){
        delete(fdbdata.lcuuid);
    }
    var data_req = data.data;
    var body = {'userid':0, 'isp':0, 'bandw':0, 'type':"VGATEWAY", 'lcuuid':""};

    flow_steps.push(function(a, f){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans){
                if (ans.length > 0) {
                    userid = ans[0].userid;
                    lcuuid = ans[0].lcuuid;
                    body.userid = userid;
                    body.lcuuid = lcuuid;
                    f(a);
                } else {
                    errorcallback(404, {ERR_MSG:'valve not found'});
                    app.STD_END();
                }
            },
            function(a){errorcallback(a, {ERR_MSG:'query valve error'}), app.STD_END()}
        );
    });

    if (data_req.general_bandwidth) {
        body.isp = 0
        body.bandw = data_req.general_bandwidth
        lc_utils.checkbandwidth_v2(body, errorcallback, app, p);
    } else {
        for (var i = 0; i < data_req.interfaces.length; i++) {
            (function(i){
            if (data_req.interfaces[i].if_type == 'WAN' &&
                data_req.interfaces[i].state == 1 &&
                data_req.interfaces[i].wan.ips.length) {
                flow_steps.push(function(a, f){
                    body.bandw = data_req.interfaces[i].wan.qos.max_bandwidth;
                    p.selectSql(
                        [p.iptableName, 'lcuuid', data_req.interfaces[i].wan.ips[0].ip_resource_lcuuid],
                        function(ans){
                            if (ans.length > 0) {
                                body.isp = ans[0].isp;
                                f(a);
                            } else {
                                errorcallback(404, {ERR_MSG:'ip_resource not found'});
                                app.STD_END();
                            }
                        },
                        function(a){errorcallback(a, {ERR_MSG:'query ip_resource error'}), app.STD_END()}
                    );
                });
                lc_utils.checkbandwidth_v2(body, errorcallback, app, p);
            }
            })(i)
        }
    }

    if ('lcuuid' in data_req)
        delete(data_req.lcuuid);

    if ('id' in data_req) {
        delete(data_req.id);
    }
    var bdbdata = lc_utils.upperJsonKey(data_req);

    flow_steps.push(function(a, f){
        operationLog.create({operation:'update', objecttype:'valve', objectid:data.id,
            object_userid:userid, operator_name:operator_name});
        p.sendData('/v1/valves/'+lcuuid, 'patch', bdbdata, function(sCode, rdata){
            if (sCode == 200){
                p.updateSql(
                    [p.tableName, fdbdata, 'lcuuid', lcuuid],
                    function(ans){
                        callback(rdata);
                    },
                    errorcallback
                    )
            } else{
                errorcallback(sCode, {ERR_MSG:'patch valve error'});
            }
        }, errorcallback);
    });
    app.fire('', function(){});
};

Valve.prototype.setepc = function(data, callback, errorcallback){
    logger.debug('set valve epc_id', data);
    var p = this;
    p.action = 'setepc';
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f) {
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans) {
                if (ans.length > 0) {
                    data.lcuuid = ans[0].lcuuid;
                    data.userid = ans[0].userid;
                    if('domain' in data){
                        if(ans[0].domain != data.domain){
                            errorcallback(400, {OPT_STATUS: constr.OPT.EPC_DOMAIN_DIFFERENT, DESCRIPTION: 'epc domain is different'});
                            app.STD_END();
                        }
                    }
                    f(a);
                } else {
                    errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: 'VGATEWAY not found'});
                    app.STD_END();
                }
            },
            function() {
                errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB error when get VGATEWAY'});
                app.STD_END();
            }
        );
    });

    var talker_data = {EPC_ID: data.epc_id}
    flow_steps.push(function(a, f) {
        p.sendData('/v1/valves/'+data.lcuuid, 'patch', talker_data, function(code, resp){
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
                    operation:'setepc', objecttype:'valve', objectid:data.id,
                    object_userid:data.userid, operator_name:data.operator_name,
                    opt_result:1
                }, function(){}, function(){});
                callback(a);
                f(a);
            },
            function() {
                operationLog.create_and_update({
                    operation:'setepc', objecttype:'valve', objectid:data.id,
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


Valve.prototype.modify_valve_name = function(data, callback, errorcallback){
    logger.debug('modify valve name', data);
    var p = this;

    if(!('id' in data) || !('name' in data) ){
        callback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL });
        return;
    }

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f) {
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans) {
                if (ans.length > 0) {
                    data.lcuuid = ans[0].lcuuid;
                    data.userid = ans[0].userid;
                    f(a);
                } else {
                    errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: 'VGATEWAY not found'});
                    app.STD_END();
                }
            },
            function() {
                errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB error when get VGATEWAY'});
                app.STD_END();
            }
        );
    });

    flow_steps.push(function(a, f) {
        p.sendData('/v1/valves/'+data.lcuuid, 'patch', {name: data.name}, function(code, resp){
            if (code == 200) {
                f(a);
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
            [p.tableName, {'name': data.name}, 'lcuuid', data.lcuuid],
            function(ans){
                operationLog.create_and_update({
                    operation:'modify', objecttype:'valve', objectid:data.id,
                    object_userid:data.userid, operator_name:data.operator_name,
                    opt_result:1
                }, function(){}, function(){});
                callback({OPT_STATUS: 'SUCCESS'});
                f(a);
            },
            function() {
                operationLog.create_and_update({
                    operation:'modify', objecttype:'valve', objectid:data.id,
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


Valve.prototype.del = function(data, callback, errorcallback){
    logger.debug('deleting valve', data);
    var p = this;
    p.action = 'delete';
    var fdbdata = p.parseApiToFdbData(data);
    if ('lcuuid' in fdbdata){
        delete(fdbdata.lcuuid);
    }
    var next = function(){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(valveans){
                if (valveans.length > 0){
                    data.lcuuid = valveans[0].lcuuid;
                    operationLog.create({operation:'delete', objecttype:'valve', objectid:data.id,
                        object_userid:valveans[0].userid, operator_name:data.operator_name});
                    p.sendData('/v1/valves/'+data.lcuuid, 'delete', {}, function(sCode, rdata){
                        p.updateSql(
                            [p.tableName, {state:p.state.DELETING}, 'lcuuid', data.lcuuid],
                            function(ans){
                                p.data_diff = {};
                                callback(rdata);
                            },
                            errorcallback
                        )
                        },
                        errorcallback
                    );
                } else{
                    operationLog.update({objecttype:'valve', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                    errorcallback(404, {ERR_MSG:'query valve error'});
                }
            },
            errorcallback
        );
    }
    p.parseApiToBdbData(data, next, false);
}

Valve.prototype.get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var condition = 'select * from ?? where true';
    var param = [p.tableName];
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    var fdb_valves = [];
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
                        errorcallback(404, {ERR_MSG : 'can not find vgatway'});
                        app.STD_END();
                    }
                },
                function(a){errorcallback(a, {ERR_MSG:'query vgaeway error'}); app.STD_END()}
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

    if ('epc_id' in data) {
        if (data.epc_id != 0 && !('userid' in data)) {
            flow_steps.push(function(a, f){
                p.selectSql(
                    [Epc.prototype.tableName, 'id', data.epc_id],
                    function(ans){
                        if (ans.length > 0) {
                            data.userid = ans[0].userid;
                            f(a);
                        } else {
                            errorcallback(404, {ERR_MSG : 'can not find user from epc'});
                            app.STD_END();
                        }
                    },
                    function(a){errorcallback(a, {ERR_MSG:'query epc error'}); app.STD_END()}
                );
            });
        }
    }

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            param,
            function(ans){
                fdb_valves = ans;
                f(a);
            },
            function(a){errorcallback(a, {ERR_MSG:'exec sql error'}); app.STD_END()}
        );
    });

    flow_steps.push(function(a, f){
        var filter = {};
        var lcuuid = '';
        if ('userid' in data) {
            filter.userid = data.userid;
        }
        if ('epc_id' in data) {
            filter.epc_id = data.epc_id;
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
        if ('id' in data) {
            lcuuid = '/' + data.lcuuid
        }
        p.sendData('/v1/valves'+lcuuid, 'get', filter, function(sCode, rdata){
            var i, j, flag;
            if (rdata.OPT_STATUS == 'SUCCESS') {
                if (rdata.DATA instanceof Array) {
                    for (i = rdata.DATA.length - 1; i >= 0; --i) {
                        flag = 0;
                        for (j = 0; j < fdb_valves.length; j++) {
                            if (rdata.DATA[i].LCUUID == fdb_valves[j].lcuuid) {
                                flag = 1;
                                rdata.DATA[i].ID = fdb_valves[j].id;
                                rdata.DATA[i].CREATE_TIME = fdb_valves[j].create_time.toMysqlFormat();
                                rdata.DATA[i].PRODUCT_SPECIFICATION_LCUUID =
                                    fdb_valves[j].product_specification_lcuuid;
                                break;
                            }
                        }
                        if (flag == 0) {
                            rdata.DATA.splice(i, 1);
                        }
                    }
                } else {
                    rdata.DATA.ID = fdb_valves[0].id;
                    rdata.DATA.CREATE_TIME = fdb_valves[0].create_time;
                    rdata.DATA.PRODUCT_SPECIFICATION_LCUUID =
                        fdb_valves[0].product_specification_lcuuid;
                }
            }
            response = rdata;
            f(a);
        },
        function(a) {errorcallback(a, {ERR_MSG:'get vgws error'}); app.STD_END()});
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
        var valves = []
        if (response.DATA instanceof Array) {
            valves = response.DATA;
        } else {
            valves[0] = response.DATA;
        }
        for (i = 0; i < valves.length; ++i) {
            var valve = valves[i];
            for (j = 0; j < valve.INTERFACES.length; ++j) {
                var vif = valve.INTERFACES[j];
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

        f(valves);
    });

    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var epc = new Epc();
    epc.fill_epc_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(response);});
}

Valve.prototype.default_event_parser = function(data, callback, errorcallback){
    var p = this;
    //translate isolation, snapshot to db,
    logger.info(data);
    if (data.state == p.state.DELETED){
        var msg = {type:'user', target:data.userid, msg:{action:'delete', state:'done', type:'valve', id:data.id,data:data}};
        p.sendToMsgCenter(msg);
        p.deleteSql([this.tableName, 'lcuuid', data.lcuuid],
                    function(ans) {
                        p.stop_charge_handler(errorcallback);
                        callback(ans);
                    },
                    function() {
                        p.writeToSql(callback, errorcallback, true);
                    })

    } else{
        p.writeToSql(callback, errorcallback);
    }
}

// config valve
Valve.prototype.check_valve_config_url = function(data, errorcallback) {
    if (!('config' in data) || ['snats', 'dnats', 'forward_acls', 'vpns', 'routes'].indexOf(data.config) == -1) {
        var response = {};
        response.OPT_STATUS = constr.OPT.INVALID_POST_DATA;
        response.DESCRIPTION = "Invalid request url, config must be one of: snats, dnats, forward_acls, vpns, routes";
        errorcallback(400, response);
        return false;
    }

    return true;
}

Valve.prototype.get_config = function(data, callback, errorcallback){
    var p = this;

    if (!p.check_valve_config_url(data, errorcallback)) {
        return;
    }

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f){
        p.sendData('/v1/valves/' + data.valve_lcuuid + '/' + data.config, 'get', data.DATA,
            function(code, resp){
                if (resp.OPT_STATUS == 'SUCCESS') {
                    callback(resp);
                    f(a);
                } else {
                    errorcallback(code, resp);
                    app.STD_END();
                }
            },
            function(code, resp){
                var response = {};
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "Talker Error";
                }
                errorcallback(code, response);
                app.STD_END();
            }
        );
    });

    app.fire('', function(){});
}

Valve.prototype.update_config = function(data, callback, errorcallback){
    var p = this;

    if (!('DATA' in data)) {
        var response = {};
        response.OPT_STATUS = constr.OPT.INVALID_POST_DATA;
        response.DESCRIPTION = "Invalid payload, can not find 'DATA'";
        errorcallback(400, response);
        return false;
    }
    if (!p.check_valve_config_url(data, errorcallback)) {
        return;
    }

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f){
        p.selectSql(
            [p.tableName, 'lcuuid', data.valve_lcuuid],
            function(ans){
                if (ans.length) {
                    data.USERID = ans[0].userid;
                    data.VGATEWAY_ID = ans[0].id;
                    f(a);
                } else {
                    errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: "valve not found"});
                    app.STD_END();
                }
            },
            function() {
                errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: "DB Error"});
                app.STD_END();
            }
        );
    });

    flow_steps.push(function(a, f){
        p.sendData('/v1/valves/' + data.valve_lcuuid + '/' + data.config, 'put', data.DATA,
            function(code, resp){
                if (resp.OPT_STATUS == 'SUCCESS') {
                    callback(resp);
                    operationLog.create_and_update({
                        operation:'config', objecttype:'valve', objectid:data.VGATEWAY_ID,
                        object_userid:data.USERID, operator_name:data.operator_name,
                        opt_result:1}, function(){}, function(){});
                    f(a);
                } else {
                    operationLog.create_and_update({
                        operation:'config', objecttype:'valve', objectid:data.VGATEWAY_ID,
                        object_userid:data.USERID, operator_name:data.operator_name,
                        opt_result:2, error_code:'SERVICE_EXCEPTION'}, function(){}, function(){});
                    errorcallback(code, resp);
                    app.STD_END();
                }
            },
            function(code, resp){
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "Talker Error";
                }
                operationLog.create_and_update({
                    operation:'config', objecttype:'valve', objectid:data.VGATEWAY_ID,
                    object_userid:data.USERID, operator_name:data.operator_name,
                    opt_result:2, error_code:'SERVICE_EXCEPTION'}, function(){}, function(){});
                errorcallback(code, response);
                app.STD_END();
            }
        );
    });

    app.fire('', function(){});
}

Valve.prototype.check = function(e){
    return true;
}
var a = new Valve();
//a.update({id:1004, name:'fsd'}, console.log, console.log);
module.exports=Valve;
