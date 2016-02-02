var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var lc_utils = require('./lc_utils.js');
var Instance = require('./instance.js');
var constr = require('./const.js');
var user = require('./user.js');
var Isp = require('./isp.js');
var Epc = require('./epc.js');
var Vl2 = require('./vl2.js');
var Domain = require('./domain.js');
var Cashier = require('./cashier.js');

var Vfw = function(){
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
        'is_expired',
        'lcuuid',
        'product_specification_lcuuid',
        'operationid',
        'role',
        'domain',
    ];
}
util.inherits(Vfw, Obj);

Vfw.prototype.tableName = 'fdb_vm_v2_2';
Vfw.prototype.promotion_rules_detail_tableName = 'promotion_rules_detail';


Vfw.prototype.get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var ip_response = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var fdb_vms = new lc_utils.Map();
    var response;
    var userid;

    var condition = 'select * from ?? where true and role=\'6\' ';
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
    }else if ('domain' in data) {
        condition += ' and ??=?';
        param.push('domain');
        param.push(data.domain);
    }

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            [Vfw.prototype.tableName].concat(param),
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
        if ('lcuuid' in data) {
            lcuuid = '/' + data.lcuuid;
            filter = {};
        }
        p.sendData('/v1/vfws' + lcuuid , 'get', filter, function(sCode, rdata){
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

Vfw.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    p.selectSql([p.tableName, 'id', data.id],function(vfw_ans) {
        if (vfw_ans.length > 0){
            data.lcuuid = vfw_ans[0].lcuuid;
            data.USERID = vfw_ans[0].userid;
            data.product_specification_lcuuid = vfw_ans[0].product_specification_lcuuid;
            data.DOMAIN = vfw_ans[0].domain;
            p.data = data;
            data.PRODUCT_TYPE = 'vfw';

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

Vfw.prototype.start_charge_handler = function(callback, errorcallback) {
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
        p.sendData('/v1/charges/vfws/' + p.data.lcuuid,'post',filter,function(sCode, data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                if(rdata.DATA.RULE_FLAG && rdata.DATA.USER_PRICE_DAYS > 0){
                    var condition_insert = "INSERT INTO ?? (promotion_rules_id,object_type,object_lcuuid,present_days,present_quantity,userid)values(?,?,?,?,?,?);";
                    var param_insert = [Vfw.prototype.promotion_rules_detail_tableName];
                    param_insert.push(rdata.DATA.PROMOTION_RULES_ID);
                    param_insert.push('vfw');
                    param_insert.push(p.data.lcuuid);
                    param_insert.push(rdata.DATA.USER_PRICE_DAYS);
                    param_insert.push(rdata.DATA.USER_PRESENT_QUANTIY);
                    param_insert.push(p.data.USERID);
                    p.executeSql(condition_insert)(param_insert, function(rdata){},errorcallback);
                }
                logger.debug('add vfw charge record success');
                callback();
            } else {
                logger.debug('add vfw charge record failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add vfw charge record failed'});
            }
        },
        function() {
            logger.error('add vfw charge request failed');
            errorcallback(500, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add vfw charge record failed'});
        });
    }

    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);
}

Vfw.prototype.stop_charge = function(data, callback) {
    var p = this;
    var lcuuid = '';
    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    p.sendData('/v1/charges/vfws/' + lcuuid, 'delete', {},function(sCode, rdata) {
        var condition_del = "DELETE FROM ?? where object_type='vfw' and ??=?";
        var param_del = [Vfw.prototype.promotion_rules_detail_tableName];
        param_del.push('object_lcuuid');
        param_del.push(lcuuid);
        p.executeSql(condition_del)(param_del, function(rdata){},errorcallback);
        callback(rdata);
    }, errorcallback);
}

module.exports=Vfw;
