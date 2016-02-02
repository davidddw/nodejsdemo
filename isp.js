var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var flow = require('./flow.js');
var Epc = require('./epc.js');
var lc_utils = require('./lc_utils.js');
var Vl2 = require('./vl2.js');
var operationLog = require('./operation_log.js');
var uuid = require('node-uuid');
var constr = require('./const.js');
var balance = require('./balance.js');
var user = require('./user.js');
var Cashier = require('./cashier.js');
var Domain = require('./domain.js');
var order_charge = require('./order_charge.js');

const DEFAULT_PAGE_SIZE = 100000000;

var Isp = function(){
    Obj.call(this);
};
util.inherits(Isp, Obj);
Isp.prototype.type = 'isp';
Isp.prototype.constructor = Isp;
Isp.prototype.bdbCols = ['name', 'userid'];
Isp.prototype.fdb_user_tableName = 'fdb_user_v2_2';
Isp.prototype.iptableName = 'ip_resource_v2_2';
Isp.prototype.viftableName = 'vinterface_v2_2';

Isp.prototype.bwtableCols = [
    'id',
    'userid',
    'isp',
    'bandwidth',
    'product_specification_lcuuid',
    'lcuuid',
];

Isp.prototype.checkIPRequest = function(data, errorcallback) {
    var req = ['userid', 'order_id'];
    var i;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: req[i]+' not specified'});
            return false;
        }
    }

    if (!('isp' in data) && !('ip_resource_lcuuid' in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: 'isp or ip_resource_lcuuid not specified'});
        return false;
    }

    return true;
};

Isp.prototype.checkBWRequest = function(data, errorcallback) {
    var req = ['USERID', 'ISP', 'BANDWIDTH', 'PRODUCT_SPECIFICATION_LCUUID','DOMAIN'];
    var i;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: req[i]+' not specified'});
            return false;
        }
    }
    return true;
};

Isp.prototype.checkISPRequest = function(data, errorcallback){
    var req = ['name', 'userid'];
    var i;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: req[i]+' not specified'});
            return false;
        }
    }
    return true;
};

Isp.prototype.parseApiToBWData = function(data){
    var ans = {};
    var cols = this.bwtableCols, key='';
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[cols[i]] = data[key];
        } else if(cols[i] in data){
            ans[cols[i]] = data[cols[i]];
        }
    }
    return ans;
};

Isp.prototype.parseApiToBdbData = function(data, callback){
    var ans = {};
    var req = this.bdbCols;
    var i, key='';
    for (i = 0; i < req.length; i++){
        key = req[i].toUpperCase();
        if (req[i] in data) {
            ans[key] = data[req[i]];
        }
    }
    var params = [];
    new flow.parallel(params).fire('', function(){callback(ans);});
};

Isp.prototype.user_ip_resources = function(data, callback, errorcallback){
    var p = this;
    var res = p.checkIPRequest(data, errorcallback);
    if (!res){
        return;
    }
    var operator_name = data.operator_name;
    delete(data.operator_name);

    var con = '';
    var params;
    var alloc_tag = uuid.v4();
    if ('ip_resource_lcuuid' in data) {
        con = 'update ?? set ? where lcuuid=? and domain=? and (userid=0 or userid is NULL)';
        params = [p.iptableName,
                  {'userid':data.userid,
                   'order_id':data.order_id,
                   'alloc_tag':alloc_tag},
                  data.ip_resource_lcuuid,data.domain];
    } else {
        con = 'update ?? set ? where isp=? and domain=? and (userid=0 or userid is NULL) limit 1';
        params = [p.iptableName,
                  {'userid':data.userid,
                   'order_id':data.order_id,
                   'alloc_tag':alloc_tag},
                  data.isp,data.domain];
    }
    p.executeSql(con)(
        params,
        function(ans){
            p.selectSql(
                [p.iptableName, 'alloc_tag', alloc_tag],
                function(ans){
                    var response = {};
                    if (ans.length > 0) {
                        operationLog.create_and_update({operation:'create', objecttype:'isp_ip_resource', objectid:ans[0].id,
                            object_userid:ans[0].userid, operator_name:operator_name, opt_result:1}, function(){}, function(){});
                        response.OPT_STATUS = "SUCCESS";
                        response.DATA = {'IN_USE':false,
                                         'IP_RESOURCE_LCUUID':ans[0].lcuuid,
                                         'IP':ans[0].ip,
                                         'NETMASK':ans[0].netmask,
                                         'GATEWAY':ans[0].gateway,
                                         'POOLID':ans[0].poolid,
                                         'USERID':ans[0].userid,
                                         'ORDER_ID':ans[0].order_id,
                                         'ISP':ans[0].isp,
                                         'VLANTAG':ans[0].vlantag,
                                         'PRODUCT_SPECIFICATION_LCUUID':ans[0].product_specification_lcuuid};
                        p.sendToMsgCenter({type:'user',target:ans[0].userid,msg:{action:'create', state:'done', type:'ip', id:ans[0].id,
                            data:{'order_id':data.order_id,'product_specification_lcuuid':ans[0].product_specification_lcuuid,'ip':ans[0].ip}}});
                        callback(response);
                    } else {
                        response.OPT_STATUS = constr.OPT.NOT_ENOUGH_IP_RESOURCE;
                        response.DESCRIPTION = "Not enough ip resources";
                        errorcallback(400, response);
                    }
                },
                function(){errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB Error when lookup the assigned ip'});}
            );
        },
        function(){errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'DB Error when assign ip'});}
    );
};

Isp.prototype.del_user_ip_resources = function(data, callback, errorcallback){
    var p = this;
    var operator_name = data.operator_name;
    delete(data.operator_name);
    p.selectSql(
        [p.iptableName, 'lcuuid', data.ip_resource_lcuuid],
        function(ans){
            if (ans.length > 0) {
                var id = ans[0].id;
                var userid = ans[0].userid;
                data.lcuuid = ans[0].lcuuid;
                data.userid = ans[0].userid;
                data.domain = ans[0].domain;
                p.data = data;
                if (ans[0].vifid > 0) {
                    callback({OPT_STATUS: constr.OPT.IP_RESOURCE_INUSE, DESCRIPTION: "ip resource is inuse"});
                } else {
                    p.updateSql(
                        [p.iptableName, {'userid':0}, 'lcuuid', data.ip_resource_lcuuid],
                        function(ans){
                            operationLog.create_and_update({operation:'delete', objecttype:'isp_ip_resource', objectid:id,
                                object_userid:userid, operator_name:operator_name, opt_result:1}, function(){}, function(){});
                            p.stop_charge_handler('ips');
                            callback({OPT_STATUS: constr.OPT.SUCCESS});
                        },
                        errorcallback
                    );
                }
            } else {
                errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: "ip resource not found"});
            }
        },
        errorcallback
    );
};

Isp.prototype.get_user_ip_resources = function(data, callback, errorcallback){
    var p = this;
    var condition = 'select * from ?? where true';
    var param = [p.iptableName];
    var response = {OPT_STATUS: constr.OPT.SUCCESS, DATA:[]};

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

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
    if ('domain' in data) {
        condition += ' and ??=?';
        param.push('domain');
        param.push(data.domain);
    }

    if (!('page_index' in data) || data.page_index <= 0) {
        data.page_index = 1;
    }
    if (!('page_size' in data) || data.page_size <= 0) {
        data.page_size = DEFAULT_PAGE_SIZE;
    }
    data.page_index = parseInt(data.page_index);
    data.page_size = parseInt(data.page_size);
    var data_offset = (data.page_index - 1) * data.page_size;

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            param,
            function(ans){
                if (ans.length > 0) {
                    var tmp;
                    for (var i = 0; i + data_offset < ans.length && i < data.page_size; i++) {
                        tmp = {'IN_USE': ans[i + data_offset].vifid ? true : false,
                               'IP_RESOURCE_LCUUID': ans[i + data_offset].lcuuid,
                               'IP':ans[i + data_offset].ip,
                               'NETMASK':ans[i + data_offset].netmask,
                               'GATEWAY':ans[i + data_offset].gateway,
                               'POOLID':ans[i + data_offset].poolid,
                               'ORDER_ID':ans[i + data_offset].order_id,
                               'USERID':ans[i + data_offset].userid,
                               'DOMAIN':ans[i + data_offset].domain,
                               'ISP':ans[i + data_offset].isp,
                               'VLANTAG':ans[i + data_offset].vlantag,
                               'PRODUCT_SPECIFICATION_LCUUID':ans[i + data_offset].product_specification_lcuuid};
                        response.DATA.push(tmp);
                    }
                    response.PAGE = {
                        INDEX: data.page_index,
                        TOTAL: Math.ceil(ans.length / data.page_size),
                        SIZE: data.page_size,
                    };
                }
                f(response.DATA);
            },
            errorcallback
        );
    });

    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(response);});
};

Isp.prototype.user_order_isp_bandwidths = function(data, callback, errorcallback){
    var p = this;
    var res = p.checkBWRequest(data, errorcallback);
    if (!res) {
        return;
    }

    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var operator_name = data.operator_name;
    delete(data.operator_name);
    flow_steps.push(function(a, f){
        p.sendData('/v1/bandwidth-orders', 'post', data,
            function(code, resp){
                if (resp.OPT_STATUS === 'SUCCESS') {
                    if (data.BANDWIDTH > 0) {
                        operationLog.create_and_update({
                            operation:'create', objecttype:'user_order_isp_bandwidth',
                            objectid:resp.DATA.ID, object_userid:data.USERID, operator_name:operator_name,
                            opt_result:1}, function(){}, function(){});
                        p.sendToMsgCenter({type:'user',target:data.USERID, msg:{action:'create', state:'done', type:'bandwidth', id:resp.DATA.ID,
                            data:{'order_id':data.ORDER_ID,'product_specification_lcuuid':data.PRODUCT_SPECIFICATION_LCUUID,'bandwidth':data.BANDWIDTH}}});
                    } else {
                        operationLog.create_and_update({
                            operation:'delete', objecttype:'user_order_isp_bandwidth',
                            objectid:resp.DATA.ID, object_userid:data.USERID, operator_name:operator_name,
                            opt_result:1}, function(){}, function(){});
                    }
                    callback(resp);
                    f(a);
                } else {
                    errorcallback(code, resp);
                    app.STD_END();
                }
            },
            function(code, resp){
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });

    app.fire('', function(){logger.info('create user_order_isp_bandwidth success.');});
};

Isp.prototype.get_user_isp_bandwidths = function(data, callback, errorcallback){
    var p = this;

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    var uri = '';
    if ('lcuuid' in data) {
        uri = '/' + data.lcuuid;
    }

    flow_steps.push(function(a, f){
        p.sendData('/v1/bandwidths' + uri, 'get', data,
            function(code, resp){
                if (resp.OPT_STATUS === 'SUCCESS') {
                    data.response = resp;
                    f(resp.DATA);
                } else {
                    errorcallback(code, resp);
                    app.STD_END();
                }
            },
            function(code, resp){
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });

    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(data.response);});
};

Isp.prototype.update_user_isp_bandwidths = function(data, callback, errorcallback){
    var p = this;
    p.action = 'modify';
    var operator_name = data.operator_name;
    var lcuuid = data.lcuuid;

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    data.ORIGINAL_BANDWIDTH = {};

    if (!('BANDWIDTH' in data)) {
        errorcallback(400, {
            OPT_STATUS: constr.OPT.INVALID_POST_DATA,
            DESCRIPTION: 'Payload must include BANDWIDTH',
        });
        return;
    }

    /* get original total bandwidth */

    flow_steps.push(function(a, f){
        p.sendData('/v1/bandwidths/' + data.lcuuid, 'get', {},function(code, resp){
            if (resp.OPT_STATUS === 'SUCCESS') {
                data.ORIGINAL_BANDWIDTH = resp.DATA;
                if (data.BANDWIDTH === data.ORIGINAL_BANDWIDTH.BANDWIDTH) {
                    /* nothing changed */
                    callback(resp);
                    app.STD_END();
                } else if (data.BANDWIDTH < data.ORIGINAL_BANDWIDTH.USED_BANDWIDTH) {
                    errorcallback(400, {
                        OPT_STATUS: constr.OPT.NOT_ENOUGH_BANDWIDTH,
                        DESCRIPTION: 'BANDWIDTH must >= USED_BANDWIDTH.',
                    });
                    app.STD_END();
                } else {
                    f(a);
                }
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
                response.DESCRIPTION = "Talker GET bandwidths failed.";
            }
            errorcallback(code, response);
            app.STD_END();
        });
    });

    /* get isp name */

    flow_steps.push(function(a, f){
        p.sendData('/v1/isps/' + data.ORIGINAL_BANDWIDTH.ISP, 'get',
            {
                userid: data.ORIGINAL_BANDWIDTH.USERID,
                domain: data.ORIGINAL_BANDWIDTH.DOMAIN,
            },
            function(code, resp){
                if (resp.OPT_STATUS === 'SUCCESS') {
                    data.ISP_NAME = resp.DATA.NAME;
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
                    response.DESCRIPTION = "Talker GET isps failed.";
                }
                errorcallback(code, response);
                app.STD_END();
            }
        );
    });

    /* get user info */

    flow_steps.push(function(a, f) {
        var condition = 'select session,useruuid from ?? where ??=?';
        var param = [];
        param.push('id');
        param.push(data.ORIGINAL_BANDWIDTH.USERID);
        p.executeSql(condition)([p.fdb_user_tableName].concat(param),
            function (ans) {
                if (ans !== null && ans.length > 0) {
                    data.SESSION = ans[0].session;
                    data.USERUUID = ans[0].useruuid;
                    f(a);
                } else {
                    errorcallback(500, {
                        OPT_STATUS: constr.OPT.SERVER_ERROR,
                        DESCRIPTION: 'failed to get session for user ' + data.ORIGINAL_BANDWIDTH.USERID,
                    });
                    app.STD_END();
                }
            },
            function(a){errorcallback(a); app.STD_END();}
        );
    });

    /* check balance */

    flow_steps.push(function(a, f){
        if (data.BANDWIDTH > data.ORIGINAL_BANDWIDTH.BANDWIDTH) {
            var check_balance = {
                USERUUID: data.USERUUID,
                BANDWIDTHS: [{
                    PRODUCT_SPECIFICATION_LCUUID: data.ORIGINAL_BANDWIDTH.PRODUCT_SPECIFICATION_LCUUID,
                    ISP: data.ORIGINAL_BANDWIDTH.ISP,
                    BANDWIDTH: data.BANDWIDTH - data.ORIGINAL_BANDWIDTH.BANDWIDTH,
                    DOMAIN: data.ORIGINAL_BANDWIDTH.DOMAIN,
                }],
            };
            p.callCharge('/balance-checks', 'post', check_balance,
                function(resp) {
                    logger.info('balance check for bandwidth modify succeed');
                    f(a);
                },
                function() {
                    logger.error('balance check for bandwidth modify failed');
                    errorcallback(402, {
                        OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE,
                        DESCRIPTION: 'check bandwidth balance failed',
                    });
                    app.STD_END();
                }
            );
        } else {
            logger.info('skip balance check for bandwidth shrink');
            f(a);
        }
    });

    /* create order */

    flow_steps.push(function(a, f){
        var order_create = {
            user_id: data.ORIGINAL_BANDWIDTH.USERID,
            domain: data.ORIGINAL_BANDWIDTH.DOMAIN,
            session: data.SESSION,
            data: {},
            useruuid: data.USERUUID,
            content: JSON.stringify({
                bandwidth: [
                    'Modify bandwidth ' + data.ISP_NAME + ' from ' +
                    (data.ORIGINAL_BANDWIDTH.BANDWIDTH >> 20) + 'M to ' +
                    (data.BANDWIDTH >> 20) + 'M',
                ],
            }),
            autoconfirm: 0,
            isconfirmed: 0,
        };
        p.callbackWeb('/order/addorder', 'post', order_create,
            function(code, resp){
                if (resp.OPT_STATUS == 'SUCCESS') {
                    logger.info(
                        'Bandwidth', data.ISP_NAME,
                        'modify continue since addorder success:', arguments);
                    data.ORDER_ID = resp.ORDER_ID;
                    f(a);
                } else {
                    errorcallback(code, resp);
                    app.STD_END();
                }
            },
            function(code, resp) {
                var response = {};
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.ORDER_PROCESS_ERROR;
                    response.DESCRIPTION = "Web API addorder failed.";
                }
                errorcallback(code, response);
            }
        );
    });

    /* modify bandwidth */

    flow_steps.push(function(a, f){
        var bw_create = {
            operator_name: data.operator_name,
            DOMAIN: data.ORIGINAL_BANDWIDTH.DOMAIN,
            USERID: data.ORIGINAL_BANDWIDTH.USERID,
            ISP: data.ORIGINAL_BANDWIDTH.ISP,
            ORDER_ID: data.ORDER_ID,
            BANDWIDTH: data.BANDWIDTH - data.ORIGINAL_BANDWIDTH.BANDWIDTH,
            PRODUCT_SPECIFICATION_LCUUID: data.ORIGINAL_BANDWIDTH.PRODUCT_SPECIFICATION_LCUUID,
        };
        p.user_order_isp_bandwidths(bw_create,
            function(resp){
                if (resp.OPT_STATUS === 'SUCCESS') {
                    f(a);
                } else {
                    errorcallback(resp);
                    app.STD_END();
                }
            },
            function(code, resp) {
                var response = {};
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                    response.DESCRIPTION = "Talker API POST bandwidth-orders failed.";
                }
                errorcallback(code, response);
                app.STD_END();
            }
        );
    });

    /* confirm order */

    flow_steps.push(function(a, f) {
        var charge = new order_charge();
        var charge_data = {
            order_id: data.ORDER_ID,
            domain: data.ORIGINAL_BANDWIDTH.DOMAIN,
            userid: data.ORIGINAL_BANDWIDTH.USERID,
            detail: JSON.stringify({BANDWIDTHS: [{}]})
        };
        charge.get(charge_data, function(charge_response){f(charge_response);}, errorcallback);
    });

    flow_steps.push(function(charge_response, f) {
        delete(charge_response['OPT_STATUS']);
        charge_response.opt_status = constr.OPT.SUCCESS;
        charge_response.orderid = data.ORDER_ID;
        p.callbackWeb('/order/confirmorder', 'post', charge_response,
            function(code, resp){
                logger.info(
                    'Bandwidth', data.ISP_NAME,
                    'modify continue since addorder success:', arguments);
                f(charge_response);
            },
            function(code, resp) {
                var response = {};
                try {
                    response = JSON.parse(JSON.stringify(resp));
                } catch(e) {
                    response.OPT_STATUS = constr.OPT.ORDER_PROCESS_ERROR;
                    response.DESCRIPTION = "Web API confirmorder failed.";
                }
                errorcallback(code, response);
                app.STD_END();
            }
        );
    });

    app.fire('', function(){
        callback({OPT_STATUS: constr.OPT.SUCCESS});
        logger.info('Bandwidth modify to', data.BANDWIDTH, ' succeed.');
    });
};

Isp.prototype.get_user_order_isp_bandwidths = function(data, callback, errorcallback){
    var p = this;

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f){
        p.sendData('/v1/bandwidth-orders', 'get', data,
            function(code, resp){
                if (resp.OPT_STATUS === 'SUCCESS') {
                    data.response = resp;
                    f(resp.DATA);
                } else {
                    errorcallback(code, resp);
                    app.STD_END();
                }
            },
            function(code, resp){
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });

    user.fill_user_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(data.response);});
};

Isp.prototype.create_isp = function(data, callback, errorcallback){
    var p = this;
    p.action = 'create';
    var operator_name = data.operator_name;
    delete(data.operator_name);
    var res = p.checkISPRequest(data, errorcallback);
    if (!res){
        return;
    }
    data.state = 2;
    var next = function(bdbdata){
        p.insertSql(
            [Vl2.prototype.tableName, data],
            function(ans){
                id = ans.insertId;
                p.selectSql(
                    [Vl2.prototype.tableName, 'id', id],
                    function(ans){
                        p.sendData('/v1/isps', 'post', bdbdata, function(sCode, data){
                            if (data.OPT_STATUS === 'SUCCESS') {
                                operationLog.create_and_update({operation:'create', objecttype:'isp', objectid:id,
                                    object_userid:ans[0].userid, operator_name:operator_name, opt_result:1},
                                    function(){}, function(){});
                                var diff = p.makeDiff(lc_utils.lowerJsonKey(data.DATA), ans[0]);
                                p.updateSql(
                                    [Vl2.prototype.tableName, diff.fdb, 'id', id],
                                    function(ans){
                                        data.DATA.ID = id;
                                        callback(data);
                                    },
                                    errorcallback
                                );
                            } else {
                                p.deleteSql(
                                    [Vl2.prototype.tableName, 'id', id],
                                    function(ans){},
                                    errorcallback
                                );
                                callback(data);
                            }
                        }, function(a, b){errorcallback(a, b)});
                    },
                    errorcallback
                );
            },
            errorcallback
        );};
    p.parseApiToBdbData(data, next);
};

Isp.prototype.del_isp = function(data, callback, errorcallback){
    var p = this;
    p.action = 'delete';
    var lcuuid = data.lcuuid;
    var operator_name = data.operator_name;
    delete(data.operator_name);
    p.selectSql(
        [Vl2.prototype.tableName, 'lcuuid', lcuuid],
        function(ans){
            if (ans.length) {
                p.sendData('/v1/isps/'+lcuuid, 'delete', {}, function(sCode, data){
                    if (data.OPT_STATUS === 'SUCCESS') {
                        operationLog.create_and_update({operation:'delete', objecttype:'isp', objectid:ans[0].id,
                            object_userid:ans[0].userid, operator_name:operator_name, opt_result:1}, function(){}, function(){});
                        p.deleteSql(
                            [Vl2.prototype.tableName, 'lcuuid', lcuuid],
                            function(ans){},
                            errorcallback
                        );
                    }
                    callback(data);
                }, function(a, b){errorcallback(a, b);});
            } else {
                errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: "isp not found"});
            }
        },
        errorcallback
    );
};

Isp.prototype.update_isp = function(data, callback, errorcallback){
    var p = this;
    p.action = 'modify';
    var operator_name = data.operator_name;
    delete(data.operator_name);
    var lcuuid = data.lcuuid;
    delete(data.lcuuid);

    if (!('name' in data)) {
        errorcallback(400, {ERR_MSG : 'name not specified'});
        return;
    }

    var name = data.name;
    var bdbdata = lc_utils.upperJsonKey(data);

    p.selectSql(
        [Vl2.prototype.tableName, 'lcuuid', lcuuid],
        function(ans){
            if (ans.length) {
                p.sendData('/v1/isps/'+lcuuid, 'put', bdbdata, function(sCode, data){
                    if (data.OPT_STATUS === 'SUCCESS') {
                        operationLog.create_and_update({operation:'update', objecttype:'isp', objectid:ans[0].id,
                            object_userid:ans[0].userid, operator_name:operator_name, opt_result:1}, function(){}, function(){});
                        p.updateSql(
                            [Vl2.prototype.tableName, {'name':name}, 'lcuuid', lcuuid],
                            function(ans){},
                            errorcallback
                        );
                    }
                    callback(data);
                }, function(a, b){errorcallback(a, b);});
            } else {
                errorcallback(404);
            }
        },
        errorcallback
    );
};

Isp.prototype.get_isp = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';
    var condition = 'select * from ?? where true';
    var param = [Vl2.prototype.tableName];
    var lcuuid = '';
    var filter = {};

    if ('lcuuid' in data) {
        condition += ' and ??=?';
        param.push('lcuuid');
        param.push(data.lcuuid);
        lcuuid = '/' + data.lcuuid;
    } else {
        condition += ' and isp!=0';
        if ('userid' in data) {
            condition += ' and ??=? or userid=0';
            param.push('userid');
            param.push(data.userid);
            filter.userid = data.userid;
        } else {
            condition += ' and userid=0';
        }
        if ('domain' in data) {
            condition += ' and domain=?';
            param.push(data.domain);
            filter.domain = data.domain;
        }
    }
    p.executeSql(condition)(
        param,
        function(ans){
            p.sendData('/v1/isps'+ lcuuid, 'get', filter, function(sCode, rdata){
                var i, j, flag;
                if (rdata.OPT_STATUS === 'SUCCESS') {
                    if (rdata.DATA instanceof Array) {
                        for (i = rdata.DATA.length - 1; i >= 0 ; --i) {
                            flag = 0;
                            for (j = 0; j < ans.length; j++) {
                                if (rdata.DATA[i].LCUUID === ans[j].lcuuid) {
                                    flag = 1;
                                    rdata.DATA[i].ID = ans[j].id;
                                    break;
                                }
                            }
                            if (flag === 0) {
                                rdata.DATA.splice(i, 1);
                            }
                        }
                    } else {
                        rdata.DATA.ID = ans[0].id;
                    }
                }
                callback(rdata);
            }, function(a, b){errorcallback(a, b);});
        },
        errorcallback
    );
};

Isp.prototype.stop_charge_handler = function(obj) {
    var p = this;
    var condition = 'select useruuid from ?? where ??=?';
    var param = [];
    param.push('id');
    param.push(p.data.userid);
    p.executeSql(condition)([Isp.prototype.fdb_user_tableName].concat(param),function(ans){
        if (ans !== null && ans.length > 0) {
            var useruuid = ans[0].useruuid;
            p.callCharge('/charges/?DOMAIN=' + p.data.domain +'&TYPE=' + obj + '&LCUUID=' + p.data.lcuuid + '&USERUUID=' + useruuid, 'delete',{},function(resp){
                logger.debug('del ' + obj + ' charge record success');
            },function() {
                logger.debug('del ' + obj + ' charge record failed');
            });
        }
    }, function(a){errorcallback(a);});
};

module.exports=Isp;
