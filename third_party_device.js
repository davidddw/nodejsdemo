var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var lc_utils = require('./lc_utils.js');
var Isp = require('./isp.js');
var Instance = require('./instance.js');
var Vl2 = require('./vl2.js');
var operationLog = require('./operation_log.js');
var Epc = require('./epc.js');
var user = require('./user.js');
var constr = require('./const.js');
var Cashier = require('./cashier.js');
var Domain = require('./domain.js')
var api = require('./api.js');
var Task = require('./task.js');
var db = require('./db.js');
var data = require('./data.js');
var uuid = require('node-uuid');

var ThirdHW = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'vm_id',
        'curr_time',
        'sys_uptime',
        'type',
        'state',
        'name',
        'community',
        'data_ip',
        'ctrl_ip',
        'ctrl_mac',
        'data1_mac',
        'data2_mac',
        'data3_mac',
        'launch_server',
        'user_name',
        'user_passwd',
        'sys_os',
        'mem_size',
        'mem_used',
        'mem_usage',
        'disk_info',
        'cpu_type',
        'cpu_data',
        'cpu_num',
        'dsk_num',
        'rack_name',
        'userid',
        'domain',
        'lcuuid',
    ];
}
util.inherits(ThirdHW, Obj);
ThirdHW.prototype.type = 'thirdhw';
ThirdHW.prototype.tableName = 'third_party_device_v2_2';
ThirdHW.prototype.iptableName = 'ip_resource_v2_2';
ThirdHW.prototype.bwtableName = 'user_isp_bandwidth_v2_2';
ThirdHW.prototype.viftableName = 'vinterface_v2_2';
ThirdHW.prototype.live_connector_tableName = 'fdb_template_liveconnector_v2_2';
ThirdHW.prototype.constructor = ThirdHW;
ThirdHW.prototype.viftype = 3;
ThirdHW.prototype.state = {
        ATTACHED : 1,
        DETACHED : 2,
        EXCEPTION : 3,
        ATTACHING : 4,
        DETACHING : 5
};



ThirdHW.prototype.parseApiToFdbData = function(data){
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


ThirdHW.prototype.parseBdbToFdbData = function(data){
    var new_json = data;
    new_json.DATA = lc_utils.lowerJsonKey(data.DATA);
    return new_json;
}


ThirdHW.prototype.attach = function(data, callback, errorcallback){
    logger.debug('attach the interface of thirdhw to a subnet', data);
    var p = this;
    p.action = 'attach';
    new_json = lc_utils.upperJsonKey(data);
    delete new_json['THIRDHW_LCUUID']
    delete new_json['IF_INDEX']
    delete new_json['ID']
    delete new_json['OPERATOR_NAME']
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var body = {'userid':0, 'isp':0, 'bandw':0, 'type':"THIRDHW", 'lcuuid':""};

    flow_steps.push(function(a, f){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans){
                if (ans.length > 0) {
                    data.userid = ans[0].userid;
                    data.thirdhw_lcuuid = ans[0].lcuuid;
                    body.userid = ans[0].userid;
                    body.lcuuid = ans[0].lcuuid;
                    f(a);
                } else {
                    errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
                    app.STD_END();
                }
            },
            function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'}); app.STD_END()}
        );
    });

    if (new_json['IF_TYPE'] == 'LAN') {
        flow_steps.push(function(a, f){
            p.selectSql(
                [p.live_connector_tableName, 'id', new_json.LAN.LIVE_CONNECTOR_ID],
                function(res_data){
                    if (res_data.length > 0){
                        bandwidth = res_data[0].bandwidth
                        new_json['LAN']['QOS'] = {
                            "MIN_BANDWIDTH": bandwidth,
                            "MAX_BANDWIDTH": bandwidth
                        }
                        delete new_json['LAN']['LIVE_CONNECTOR_ID']
                        logger.info(data);
                        p.sendData('/v1/third-party-devices/' + data.thirdhw_lcuuid + '/interfaces/' + data.if_index, 'patch', new_json, function(sCode, rdata){
                            if (sCode == 200){
                                var ans = {type:'user', target:data.userid, msg:{action:'attach', state:'attached', type:'thirdhw', lcuuid:data.thirdhw_lcuuid, if_index:data.if_index}};
                                operationLog.create({operation:'attach', objecttype:'thirdhw', objectid:data.id, if_index:data.if_index,
                                    object_userid:data.userid, operatorname:data.operatorname});
                                ans.OPT_STATUS = 'SUCCESS';
                                callback(rdata);
                                f(a);
                            } else{
                                errorcallback(sCode, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'patch thirdhw intf error'});
                            }
                        }, errorcallback);

                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'live_connector not found'});
                    }
                },
                errorcallback
            );
        });
    } else {
        logger.info(data);
        if (new_json.IF_TYPE == 'WAN' && new_json.STATE == 1 && new_json.WAN.IPS.length) {
            flow_steps.push(function(a, f){
                logger.info(data);
                body.bandw = new_json.WAN.QOS.MAX_BANDWIDTH;
                p.selectSql(
                    [p.iptableName, 'lcuuid', new_json.WAN.IPS[0].IP_RESOURCE_LCUUID],
                    function(ans){
                        if (ans.length > 0) {
                            body.isp = ans[0].isp;
                            f(a);
                        } else {
                            logger.info(data);
                            errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'ip not found'});
                            app.STD_END();
                        }
                    },
                    function(a){logger.info(data);errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'}); app.STD_END();}
                );
            });
            lc_utils.checkbandwidth_v2(body, errorcallback, app, p);
        }

        logger.info(data);
        flow_steps.push(function(a, f){
            logger.info(data);
            p.sendData('/v1/third-party-devices/' + data.thirdhw_lcuuid + '/interfaces/' + data.if_index, 'patch', new_json, function(sCode, rdata){
                if (sCode == 200){
                    var ans = {type:'user', target:data.userid, msg:{action:'attach', state:'attached', type:'thirdhw', lcuuid:data.thirdhw_lcuuid, if_index:data.if_index}};
                    operationLog.create({operation:'attach', objecttype:'thirdhw', objectid:data.id, if_index:data.if_index,
                        operatorname:data.operatorname});
                    ans.OPT_STATUS = 'SUCCESS';
                    callback(rdata);
                } else{
                    errorcallback(sCode, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'patch thirdhw intf error'});
                }
            }, errorcallback);
        });
    }
    app.fire(data, function(){});
}


ThirdHW.prototype.detach = function(data, callback, errorcallback){
    logger.debug('detach the interface of thirdhw from a subnet', data);
    var p = this;
    p.action = 'detach';
    new_json = lc_utils.upperJsonKey(data);
    delete new_json['THIRDHW_LCUUID']
    delete new_json['ID']
    delete new_json['OPERATOR_NAME']
    delete new_json['WAN']
    delete new_json['IF_TYPE']
    logger.info(data);
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    flow_steps.push(function(a, f){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans){
                if (ans.length > 0) {
                    data.thirdhw_lcuuid = ans[0].lcuuid;
                    data.id = ans[0].id;
                    f(a);
                } else {
                    errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
                    app.STD_END();
                }
            },
            function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'}); app.STD_END()}
        );
    });
    flow_steps.push(function(a, f){
        p.sendData('/v1/third-party-devices/' + data.thirdhw_lcuuid + '/interfaces/' + data.if_index, 'patch', new_json, function(sCode, rdata){
            if (sCode == 200){
                console.log(rdata)
                logger.debug(rdata);
                var ans = {type:'user', target:data.userid, msg:{action:'detach', state:'detached', type:'thirdhw', lcuuid:data.thirdhw_lcuuid, if_index:data.if_index}};
                operationLog.create({operation:'detach', objecttype:'thirdhw', objectid:data.id, if_index:data.if_index,
                    operatorname:data.operatorname});
                ans.OPT_STATUS = 'SUCCESS';
                callback(rdata);
            } else{
                logger.debug("\nsCode:\n");
                logger.debug(sCode);
                logger.debug("\nrdata:\n");
                logger.debug(rdata);
                errorcallback(sCode, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'patch thirdhw intf error'});
            }
        }, errorcallback)
    });

    app.fire(data, function(){});
}

ThirdHW.prototype.get_live_connectors = function(data, callback, errorcallback){
    var p = this;
    p.selectSql(
        [p.live_connector_tableName, 'state', '1'],
        function(res_data){
            if (res_data.length > 0){
                callback({DATA:res_data, OPT_STATUS: "SUCCESS", "TYPE": "LIVE_CONNECTOR", "DESCRIPTION":""});
            } else {
                errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'live_connector not found'});
            }
        },
        errorcallback
    );
};

ThirdHW.prototype.get_thirdhws = function(data, callback, errorcallback){
    logger.debug('get all thirdhws belong to an epc', data);
    var p = this;
    var ip_response = {};
    var response;

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f){
        if ("lcuuid" in data) {
            p.selectSql(
                [p.tableName, 'lcuuid', data.lcuuid],
                function(ans){
                    if (ans.length > 0) {
                        data.userid = ans[0].userid;
                        data.thirdhw_lcuuid = ans[0].lcuuid;
                        f(a);
                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
                        app.std_end();
                    }
                },
                function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'});  app.std_end()}
            )
        } else if ("id" in data) {
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length > 0) {
                        data.userid = ans[0].userid;
                        data.thirdhw_lcuuid = ans[0].lcuuid;
                        f(a);
                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
                        app.std_end();
                    }
                },
                function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'});  app.std_end()}
            )
        } else {
            f(a);
        }
    });

    flow_steps.push(function(a, f){
        if ('epc_id' in data && data.epc_id != 0 && !('userid' in data)) {
            p.selectSql(
                [Epc.prototype.tableName, 'id', data.epc_id],
                function(ans){
                    if (ans.length > 0) {
                        data.userid = ans[0].userid;
                        f(a);
                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'epc not found'});
                        app.STD_END();
                    }
                }, errorcallback
            );
        } else {
            f(a);
        }
    });

    flow_steps.push(function(a, f){
        req_body = {};
        if ('userid' in data) {
            req_body.userid = data.userid;
        }
        if ('epc_id' in data) {
            req_body.epc_id = data.epc_id;
        }
        if ('page_index' in data) {
            req_body.page_index = data.page_index;
        }
        if ('page_size' in data) {
            req_body.page_size = data.page_size;
        }
        if ('domain' in data) {
            req_body.domain = data.domain;
        }
        if ('order_id' in data) {
            req_body.order_id = data.order_id;
        }
        if ('thirdhw_lcuuid' in data) {
            p.sendData('/v1/third-party-devices/' + data.thirdhw_lcuuid, 'get', {}, function(sCode, rdata){
                if (sCode == 200){
                    ans = {}
                    ans.DATA = rdata.DATA;
                    response = rdata;
                    f(a);
                } else{
                    logger.debug("\nsCode:\n");
                    logger.debug(sCode);
                    logger.debug("\nrdata:\n");
                    logger.debug(rdata);
                    errorcallback(sCode, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'get thirdhw error'});
                    app.STD_END();
                }
            }, function(a) {errorcallback(a, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'get thirdhw error'}); app.STD_END()});
        } else {
            p.sendData('/v1/third-party-devices', 'get', req_body, function(sCode, rdata){
                if (sCode == 200){
                    ans = {}
                    ans.DATA = rdata.DATA;
                    response = rdata;
                    f(a);
                } else {
                    logger.debug("\nsCode:\n");
                    logger.debug(sCode);
                    logger.debug("\nrdata:\n");
                    logger.debug(rdata);
                    errorcallback(sCode, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'get thirdhw error'});
                    app.STD_END();
                }
            }, function(a) {errorcallback(a, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'get thirdhw error'}); app.STD_END()});
        }
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
        var i, thdev_num;
        var thdevs = []
        if (response.DATA instanceof Array) {
            thdevs = response.DATA;
        } else {
            thdevs[0] = response.DATA;
        }
        if (thdevs.length == 0) {
            f(a);
        }
        thdev_num = 0;
        for (i = 0; i < thdevs.length; ++i) {
            var thdev = thdevs[i];
            p.selectSql(
                [p.tableName, 'lcuuid', thdev.THIRDHW_LCUUID],
                function(ans){
                    if (ans.length > 0) {
                        for (var index = 0; index < thdevs.length; ++index) {
                            if (thdevs[index].THIRDHW_LCUUID == ans[0].lcuuid) {
                                thdevs[index].ID = ans[0].id;
                                break;
                            }
                        }
                        thdev_num++;
                        if (thdev_num == thdevs.length) {
                            f(a);
                        }
                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
                        thdev_num++;
                        if (thdev_num == thdevs.length) {
                            app.std_end();
                        }
                    }
                },
                function(a){
                    errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'});
                    app.std_end();
                    thdev_num++;
                    if (thdev_num == thdevs.length) {
                        app.std_end();
                    }
                }
            );
        }
    });

    flow_steps.push(function(a, f){
        var i, j;
        var thdevs = []
        if (response.DATA instanceof Array) {
            thdevs = response.DATA;
        } else {
            thdevs[0] = response.DATA;
        }
        for (i = 0; i < thdevs.length; ++i) {
            var thdev = thdevs[i];
            for (j = 0; j < thdev.INTERFACES.length; ++j) {
                var vif = thdev.INTERFACES[j];
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

        f(thdevs);
    });

    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var epc = new Epc();
    epc.fill_epc_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire(data, function(){callback(response);});
};

ThirdHW.prototype.setepc = function(data, callback, errorcallback){
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f) {
        if ('id' in data){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans) {
                    if (ans.length > 0) {
                        data.userid = ans[0].userid;
                        data.lcuuid = ans[0].lcuuid;
                        if('domain' in data){
                            if(ans[0].domain != data.domain){
                                errorcallback(400, {OPT_STATUS: constr.OPT.EPC_DOMAIN_DIFFERENT, DESCRIPTION: 'epc domain is different'});
                                app.STD_END();
                            }
                        }
                        f(a);
                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'THIRDHW not found'});
                        app.STD_END();
                    }
                },
                function(a) {
                    errorcallback(a, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB error when get THIRDHW'});
                    app.STD_END();
                }
            );
        } else if ('lcuuid' in data){
            p.selectSql(
                [p.tableName, 'lcuuid', data.lcuuid],
                function(ans) {
                    if (ans.length > 0) {
                        data.userid = ans[0].userid;
                        data.lcuuid = ans[0].lcuuid;
                        if('domain' in data){
                            if(ans[0].domain != data.domain){
                                errorcallback(400, {OPT_STATUS: constr.OPT.EPC_DOMAIN_DIFFERENT, DESCRIPTION: 'epc domain is different'});
                                app.STD_END();
                            }
                        }
                        f(a);
                    } else {
                        errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'THIRDHW not found'});
                        app.STD_END();
                    }
                },
                function(a) {
                    errorcallback(a, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB error when get THIRDHW'});
                    app.STD_END();
                }
            );
        } else {
            callback({OPT_STATUS:constr.OPT.FAIL});
        }
    });

    var talker_data = {}
    if ('epc_id' in data){
        talker_data.EPC_ID = data.epc_id;
        p.action = 'setepc';
    } else if (data.name) {
        talker_data.NAME = data.name;
        p.action = 'modifyname';
    }
    flow_steps.push(function(a, f) {
        p.sendData('/v1/third-party-devices/'+data.lcuuid, 'patch', talker_data, function(code, resp){
            if (code == 200) {
                operationLog.create_and_update({
                    operation: p.action, objecttype:'thirdhw', objectid:data.id,
                    object_userid:data.userid, operator_name:data.operator_name,
                    opt_result:1
                }, function(){}, function(){});
                callback(resp);
                f(a);
            } else {
                operationLog.create_and_update({
                    operation: p.action, objecttype:'thirdhw', objectid:data.id,
                    object_userid:data.userid, operator_name:data.operator_name,
                    opt_result:2, error_code:'SERVICE_EXCEPTION'
                }, function(){}, function(){});
                errorcallback(code, resp);
                app.STD_END();
            }
        },
        function(code, resp) {
            operationLog.create_and_update({
                operation: p.action, objecttype:'thirdhw', objectid:data.id,
                object_userid:data.userid, operator_name:data.operator_name,
                opt_result:2, error_code:'SERVICE_EXCEPTION'
            }, function(){}, function(){});
            errorcallback(code, resp);
            app.STD_END();
        });
    });
    app.fire(data, function(){});
};


ThirdHW.prototype.updateintf = function(data, callback, errorcallback){
    logger.debug('update all the interfaces of thirdhw', data);
    var p = this;
    p.action = 'updateintf';
    data = lc_utils.upperJsonKey(data);
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var body = {'userid':0,
                'isp':0,
                'bandw':0,
                'type':"THIRDHW",
                'lcuuid':""};

    flow_steps.push(function(a, f){
        if ('ID' in data){
            condition = [p.tableName, 'id', data.ID];
        } else if ('LCUUID' in data){
            condition = [p.tableName, 'id', data.LCUUID];
        } else {
            errorcallback({OPT_STATUS: constr.OPT.FAIL});
            return;
        }
        p.selectSql(
            condition,
            function(ans){
                if (ans.length > 0) {
                    data.USERID = ans[0].userid;
                    data.THIRDHW_LCUUID = ans[0].lcuuid;
                    body.userid = ans[0].userid;
                    body.lcuuid = ans[0].lcuuid;
                    f(a);
                } else {
                    errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
                    app.STD_END();
                }
            },
            function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'}); app.STD_END()}
        );
    });

    for(var i = 0; i < data.DATA.length; i++) {
        (function(i){
            var new_json = data.DATA[i];
            if (new_json.IF_TYPE == 'LAN') {
                flow_steps.push(function(a, f){
                    p.selectSql(
                        [p.live_connector_tableName, 'id', new_json.LAN.LIVE_CONNECTOR_ID],
                        function(res_data){
                            if (res_data.length > 0){
                                bandwidth = res_data[0].bandwidth
                                new_json['LAN']['QOS'] = {
                                    "MIN_BANDWIDTH": bandwidth,
                                    "MAX_BANDWIDTH": bandwidth
                                }
                                delete new_json['LAN']['LIVE_CONNECTOR_ID']
                                logger.debug('*************update all the interfaces of thirdhw: i=%d', i);
                                f(a);
                            } else {
                                logger.debug('*************update all the interfaces of thirdhw: i=%d', i);
                                errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'live_connector not found'});
                                app.STD_END();
                            }
                        },
                        function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query thirdhw error'}); app.STD_END()}
                    );
                });
            } else if (new_json.IF_TYPE == 'WAN' && new_json.STATE == 1 && new_json.WAN.IPS.length) {
                flow_steps.push(function(a, f){
                    body.bandw = new_json.WAN.QOS.MAX_BANDWIDTH;
                    p.selectSql(
                        [p.iptableName, 'lcuuid', new_json.WAN.IPS[0].IP_RESOURCE_LCUUID],
                        function(ans){
                            if (ans.length > 0) {
                                body.isp = ans[0].isp;
                                f(a);
                            } else {
                                errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'ip_resource not found'});
                                app.STD_END();
                            }
                        },
                        function(a){errorcallback(a, {'OPT_STATUS':constr.OPT.DB_QUERY_ERROR,'DESCRIPTION':'query ip _resource error'}); app.STD_END()}
                    );
                });
                lc_utils.checkbandwidth_v2(body, errorcallback, app, p);
            }
        })(i)
    }

    flow_steps.push(function(a, f){
        req_body = data.DATA;
        p.sendData('/v1/third-party-devices/' + data.THIRDHW_LCUUID, 'patch', req_body, function(sCode, rdata){
            if (sCode == 200){
                var ans = {type:'user', target:data.USERID, msg:{action:'updateintf', state:'done', type:'thirdhw', lcuuid:data.THIRDHW_LCUUID, if_index:data.IF_INDEX}};
                operationLog.create({operation:'updateintf', objecttype:'thirdhw', objectid:data.ID, object_userid:data.USERID, operatorname:data.OPERATORNAME});
                ans.OPT_STATUS = 'SUCCESS';
                callback(rdata);
                f(a);
            } else{
                errorcallback(sCode, {'OPT_STATUS':constr.OPT.CALL_API_FAIL,'DESCRIPTION':'patch thirdhw intf error'});
                app.STD_END();
            }
        }, errorcallback);
    });

    app.fire(data, function(){});
}

ThirdHW.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans) {
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.product_specification_lcuuid = ans[0].product_specification_lcuuid;
                data.DOMAIN = ans[0].domain;
                p.data = data;
                data.PRODUCT_TYPE = 'thirdhw';
                p.start_charge_handler(function(){
                    res_data = {};
                    res_data.OPT_STATUS = 'SUCCESS';
                    res_data.DESCRIPTION = '';
                    callback(res_data);
                }, errorcallback);
            } else{
                errorcallback(404, {'OPT_STATUS':constr.OPT.RESOURCE_NOT_FOUND,'DESCRIPTION':'thirdhw not found'});
            }
        },
        errorcallback
    );
}

ThirdHW.prototype.default_event_parser = function(data, callback, errorcallback){
    var p = this;
    data = data.DATA
    //translate isolation, snapshot to db,
    logger.info(data);
    var msw = {}
    if (data.state == p.state.DETACHED){
        msg = {type:'user', msg:{action:'detach', state:'done', type:'thirdhw', id:p.data.lcuuid, data:data}};
        p.sendToMsgCenter(msg);
    } else if (data.state == p.state.ATTACHED){
        msg = {type:'user', msg:{action:'attach', state:'done', type:'thirdhw', id:p.data.lcuuid, data:data}};
        p.sendToMsgCenter(msg);
    } else if (data.state == p.state.EXCEPTION){
        msg = {type:'user', msg:{action:p.action, state:'failed', type:'thirdhw', id:p.data.lcuuid, data:data}};
        p.sendToMsgCenter(msg);
    } else {
        msg = {type:'user', msg:{action:p.action, state:'done', type:'thirdhw', id:p.data.lcuuid, data:data}};
        p.sendToMsgCenter(msg);
    }
    callback({result: 'Good'});
}

ThirdHW.prototype.start_charge_handler = function(callback,errorcallback) {
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
        p.sendData('/v1/charges/third-party-devices/' + p.data.lcuuid,'post',filter,function(sCode, data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                logger.debug('add thirdhw charge record success');
                callback();
            } else {
                logger.debug('add thirdhw charge record failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add thirdhw charge record failed'});
            }
        },
        function() {
            logger.error('add thirdhw charge request failed');
            errorcallback(500, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add thirdhw charge record failed'});
        });
    }

    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);
}

ThirdHW.prototype.check = function(e){
    return true;
}

var checkOSMap = {};
var checkOS = function(lcuuid, callback, count, checkId){
    count = count ? count : 0;
    if (count === 0){
        checkId = uuid.v4();
        if (lcuuid in checkOSMap){
            //stop last check
            logger.info('running another check, kill last one');
            checkOSMap[lcuuid].callback(false);
        }
        checkOSMap[lcuuid] = {callback:callback, checkId: checkId};
    }

    if (checkId != checkOSMap[lcuuid].checkId){
        return;
    }
    logger.info('check os at count '+count);
    var maxCount = 100, interval=60000;
    api.api.get( 'v1/third-party-devices/'+lcuuid+'/status/', '',
        function(sCode, body){
            if (body.OPT_STATUS !== constr.OPT.SUCCESS && count < maxCount){
                setTimeout(function(){
                        checkOS(lcuuid, callback, count+1, checkId);
                    }, interval)
            } else {
                delete(checkOSMap[lcuuid]);
                if (body.OPT_STATUS == constr.OPT.SUCCESS){
                    callback(true);
                } else {
                    callback(false);
                }
            }
        },
        function(sCode, body){
            if (count < maxCount){
                setTimeout(function(){
                        checkOS(lcuuid, callback, count+1, checkId);
                    }, interval)
            } else {
                logger.info('check vagent max count exceeded');
                delete(checkOSMap[lcuuid]);
                callback(false);
            }
        }
    )
}

ThirdHW.prototype.buyHW = function(options, callback){
    var action = 'buy';
    var Q = new flow.Qpack(flow.serial) ;
    logger.info('start to create hw');
    //params check
    var p = this;
    Q.setRejectHandler(callback);
    Q.then(data.checkParamsValid({
        'data': options,
        'validator': data.thirdHWbuyHW(),
    }))
    .then(
        Task.prototype.asyncTask('POST', 'v1/third-party-devices/order', options,
            function(ans){
                var msg = {type:'user',
                           target: ans.DATA.USERID,
                           msg:{action: action, state:'done',data:{state:ans.DATA.STATE,STATE:ans.DATA.STATE}, type:'thirdhw', id:ans.DATA.LCUUID}};
                msg.msg.id = ans.DATA.ID;
                p.sendToMsgCenter(msg);
            }
        )
    )
    //prepare log for install os
    .then(function(data, onFullfilled){
        Q.setData('hwData', data)
        Q.setRejectHandler(function(params){
            logger.info.apply(this, arguments);
            var comment = 'install bare metal ' + data.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: data.ID,
                object_userid: data.USERID,
                opt_result: 2,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: data.NAME,
                comment: comment,
            }).resolve('');
        });
        onFullfilled(data);
    })
    .then(function(data, onFullfilled){
        checkOS(data.LCUUID, onFullfilled)
    })
    .then(function(state, onFullfilled){
        callback(state);
        var result = state ? 1 : 2;
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            var comment = 'install bare metal '+hwData.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: result,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
            var msg = {type:'user',
                target: Q.getData('hwData').USERID,
                msg:{action: 'install', state:'done', type:'thirdhw', id:Q.getData('hwData').LCUUID}};
            msg.msg.id = Q.getData('hwData').ID;
            p.sendToMsgCenter(msg);
        }
        onFullfilled();
    })
    return Q;

}

ThirdHW.prototype.installOS = function(lcuuid, options, callback){
    var action = 'installos';
    var Q = new flow.Qpack(flow.serial) ;
    //params check
    Q.setRejectHandler(callback);
    Q.then(data.checkParamsValid({
        'data': options,
        'validator': data.thirdHWinstallOS(),
    }))
    //error log
    Q.setData('startTime', new Date().toMysqlFormat());
    Q.setRejectHandler(function(params){
        callback.apply(this, arguments);
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            var comment = 'install bare metal '+hwData.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: 2,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
        }
    });
    var p = this;
    Q.then(api.callTalker('GET', 'v1/third-party-devices/'+lcuuid, '', function(ans){
        Q.setData('userid', ans.body.DATA.USERID);
        Q.setData('hwData', ans.body.DATA);
    }))
    .then(
        Task.prototype.asyncTask('DEL', 'v1/third-party-devices/'+lcuuid+'/os', '')
    )
    .then(
        Task.prototype.asyncTask('POST', 'v1/third-party-devices/'+lcuuid+'/os', options,
            function(ans){
                callback(ans);
                var msg = {type:'user',
                           target:Q.getData('userid'),
                           msg:{action: action, state:'start', type:'thirdhw', id:lcuuid}};
                msg.msg.id = ans.DATA.ID;
                p.sendToMsgCenter(msg);
                Q.setRejectHandler(logger.info);
            }
        )
    )
    //.then(function(data, onFullfilled){
    //    checkOS(lcuuid, onFullfilled)
    //})
    .then(function(asyncData, onFullfilled){
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            var comment = 'install bare metal '+hwData.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: 1,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
            var msg = {type:'user',
                target: Q.getData('hwData').USERID,
                msg:{
                    action: action,
                    state:'done',
                    type:'thirdhw',
                    id:Q.getData('hwData').LCUUID,
                    data: {state: asyncData.DATA.STATE}
                }};
            msg.msg.id = Q.getData('hwData').ID;
            p.sendToMsgCenter(msg);
        }
        onFullfilled();
    })
    return Q;
}

ThirdHW.prototype.del = function(lcuuid, callback){
    var action = 'delete';
    var Q = new flow.Qpack(flow.serial) ;
    Q.setData('startTime', new Date().toMysqlFormat());
    //error log
    Q.setRejectHandler(function(params){
        callback.apply(this, arguments);
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            var comment = 'delete bare metal '+hwData.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: 2,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
        }
    });
    Q.then(api.callTalker('GET', 'v1/third-party-devices/'+lcuuid, '', function(ans){
        Q.setData('userid', ans.body.DATA.USERID);
        Q.setData('hwData', ans.body.DATA);
    }))
    var p = this;
    Q.then(
        Task.prototype.asyncTask('DEL', 'v1/third-party-devices/order/'+lcuuid, '',
            function(ans){
                callback(ans);
                callback = logger.info;
                var msg = {type:'user',
                           target:Q.getData('userid'),
                           msg:{action: action, state:'start', type:'thirdhw', id:lcuuid,data:{state:0,STATE:0,} }};
                msg.msg.id = ans.DATA.LCUUID;

                p.sendToMsgCenter(msg);
            })
    ).then(function(data, onFullfilled){
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            var comment = 'delete bare metal '+hwData.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: 1,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
            var msg = {type:'user',
                           target:Q.getData('userid'),
                           msg:{action: action, state:'done', type:'thirdhw', id:lcuuid }};
            msg.msg.id = data.DATA.LCUUID;
            p.sendToMsgCenter(msg);
        }
        onFullfilled();
    })
    return Q

}

//1启动 2停止 5启动中 6停止中
ThirdHW.prototype.changeState = function(lcuuid, state, callback){
    if (state == 2){
        var action = 'stop';
    } else {
        var action = 'start';
    }
    var p = this;
    var Q = new flow.Qpack(flow.serial);
    Q.setData('startTime', new Date().toMysqlFormat());
    Q.setRejectHandler(function(params){
        callback.apply(this, arguments);
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            if (state == 2){
                var comment = '停止物理服务器'+hwData.NAME;
            } else if (state == 1){
                var comment = '启动物理服务器'+hwData.NAME;
            }
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: 2,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
        }
    });
    Q.then(api.callTalker('GET', 'v1/third-party-devices/'+lcuuid, '', function(ans){
        Q.setData('userid', ans.body.DATA.USERID);
        Q.setData('hwData', ans.body.DATA);
    }))
    Q.then(
        Task.prototype.asyncTask('PATCH', 'v1/third-party-devices/'+lcuuid, {STATE:state},
            function(ans){
                callback(ans);
                var msg = {type:'user',
                           target:Q.getData('userid'),
                           msg:{action: action, state:'start', type:'thirdhw', id:lcuuid, data:{STATE:ans.DATA.STATE}}};
                msg.msg.id = ans.DATA.ID;
                p.sendToMsgCenter(msg);
            },
            function(asyncAns){
                var hwData = Q.getData('hwData');
                if (state == 2){
                    var comment = '停止物理服务器'+hwData.NAME;
                } else if (state == 1){
                    var comment = '启动物理服务器'+hwData.NAME;
                }
                if (asyncAns.OPT_STATUS == constr.OPT.SUCCESS){
                    var msg = {type:'user',
                        target:Q.getData('userid'),
                        msg:{action: action, state:'done',
                            type:'thirdhw', id:lcuuid, data:{state:asyncAns.DATA.STATE,STATE:asyncAns.DATA.STATE,},
                            output: comment+' 成功',
                        }
                    };
                } else {
                    var msg = {type:'user',
                        target:Q.getData('userid'),
                        msg:{action: action, state:'done',
                            type:'thirdhw', id:lcuuid, data:{STATE:hwData.STATE},
                            output: comment+' 失败',
                        }
                    };
                }
                msg.msg.lcuuid = data.THIRDHW_LCUUID;
                p.sendToMsgCenter(msg);
            }
        )
    ).then(function(data, onFullfilled){
        if (Q.getData('hwData')){
            var hwData = Q.getData('hwData');
            if (state == 2){
                var comment = '停止物理服务器'+hwData.NAME;
            } else if (state == 1){
                var comment = '启动物理服务器'+hwData.NAME;
            }
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'thirdhw',
                objectid: hwData.ID,
                object_userid: hwData.USERID,
                opt_result: 1,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: hwData.NAME,
                comment: comment,
            }).resolve('');
        }
        onFullfilled();
    })
    return Q
}

//var a = new ThirdHW();
//a.update({id:1004, name:'fsd'}, console.log, console.log);
module.exports=ThirdHW;
