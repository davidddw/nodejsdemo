var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var constr = require('./const.js');
var flow = require('./flow.js');
var lc_utils = require('./lc_utils.js');

var Cashier = function() {
    Obj.call(this);
}

util.inherits(Cashier, Obj);

Cashier.prototype.promotion_rules_tableName = 'promotion_rules';
Cashier.prototype.promotion_rules_detail_tableName = 'promotion_rules_detail';
Cashier.prototype.product_spec_tableName = 'product_specification_v2_2';
Cashier.prototype.product_type = {
    VM : 'vm',
    VGW : 'vgateway',
    IP: 'ip',
    BW: 'bandw',
    LB: 'load-balancer',
    VFW: 'vfw',
    THD: 'thirdhw',
    SNAPSHOT: 'snapshot',
    NAS: 'nas',
    SYS_VUL_SCANNER: 'sys-vul-scanner',
    WEB_VUL_SCANNER: 'web-vul-scanner',
    OTHER: 'other',
};


Cashier.prototype.get_charge_info = function(data, callback,errorcallback) {
    var p = this;
    var response = {OPT_STATUS: constr.OPT.FAIL, DATA:{}};
    var body = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var promotion_rules_id,purchase_type,purchase_quantity,present_type,present_quantity,event_start_time,event_end_time;
    var user_present_quantity = 0,total_size = 0,vul_num = 0,rule_flag = false,user_price_quantity = 0,user_price_days = 0,present_days = 0;
    flow_steps.push(function(a, f) {
        var condition = 'select id,purchase_type,purchase_quantity,present_type,present_quantity,present_days,event_start_time,event_end_time from ?? ';
        condition += ' where SYSDATE() > event_start_time and (event_end_time is null or event_end_time > SYSDATE())';
        var param = [];
        if ('DOMAIN' in data) {
            condition += ' and ??=?';
            param.push('domain');
            param.push(data.DOMAIN);
        }else{
            logger.info('get charge info error, domain is null');
            app.STD_END();
            return;
        }
        if ('PRODUCT_TYPE' in data) {
            condition += ' and ??=?';
            param.push('purchase_type');
            param.push(data.PRODUCT_TYPE);
        }
        p.executeSql(condition)([Cashier.prototype.promotion_rules_tableName].concat(param),function(ans){
            if (ans.length > 0) {
                rule_flag = true;
                promotion_rules_id = parseInt(ans[0].id);
                purchase_type = parseInt(ans[0].purchase_type);
                purchase_quantity = parseInt(ans[0].purchase_quantity);
                present_type = parseInt(ans[0].present_type);
                present_quantity = parseInt(ans[0].present_quantity);
                present_days = parseInt(ans[0].present_days);
                event_start_time = ans[0].event_start_time ;
                event_end_time = ans[0].event_end_time ;
            }
            f(rule_flag);
        },function(a){errorcallback(a), app.STD_END()});
    })
    flow_steps.push(function(rule_flag, f) {
        if (rule_flag && present_quantity > 0){
            if (rule_flag && data.PRODUCT_TYPE == p.product_type.NAS) {
                var condition = 'select object_lcuuid,present_quantity from ?? where ??=? and ??=? and ??>?';
                var param = [];
                param.push('userid');
                param.push(data.USERID);
                param.push('object_type');
                param.push(data.PRODUCT_TYPE);
                param.push('create_time');
                param.push(event_start_time);
                if(event_end_time!=null){
                    condition += ' and ??<? ';
                    param.push('create_time');
                    param.push(event_end_time);
                }
                var nas_map = new lc_utils.Map();
                p.executeSql(condition)([Cashier.prototype.promotion_rules_detail_tableName].concat(param),function(nas_ans){
                    if (nas_ans.length > 0) {
                        for(var i=0; i<nas_ans.length; i++){
                            total_size += parseInt(nas_ans[0].present_quantity);
                            if(nas_map.get(data.lcuuid)){
                                nas_map.put(nas_ans[i].object_lcuuid,nas_map.get(data.lcuuid)+nas_ans[i].present_quantity);
                            }else{
                                nas_map.put(nas_ans[i].object_lcuuid,nas_ans[i].present_quantity);
                            }
                        }
                    }
                    var user_apply_size = data.TOTAL_SIZE;
                    if(nas_map.get(data.lcuuid)){
                        var userNasPresentSize = nas_map.get(data.lcuuid);
                        //modify
                        if(user_apply_size > present_quantity){
                            user_price_quantity = user_apply_size - present_quantity;
                            if(userNasPresentSize > present_quantity){
                                user_present_quantity = 0;
                            }else{
                                user_present_quantity = present_quantity -userNasPresentSize;
                            }
                        }else{
                            user_price_quantity = 0;
                            user_present_quantity = user_apply_size;
                        }
                    }else{
                        //create
                        if(total_size > 0 ){
                            //to used
                            if((total_size + user_apply_size) > present_quantity){
                                user_price_quantity = total_size + user_apply_size - present_quantity;
                                user_present_quantity = present_quantity - total_size;
                            }else{
                                user_price_quantity = 0;
                                user_present_quantity = user_apply_size;
                            }
                        }else{
                            //first use
                            if(user_apply_size > present_quantity){
                                user_price_quantity = user_apply_size - present_quantity;
                                user_present_quantity = present_quantity;
                            }else{
                                user_price_quantity = 0;
                                user_present_quantity = user_apply_size;
                            }
                        }
                    }
                    f(rule_flag);
                },function(a){errorcallback(a), app.STD_END()});
            }else if(rule_flag && data.PRODUCT_TYPE == p.product_type.SYS_VUL_SCANNER || rule_flag && data.PRODUCT_TYPE == p.product_type.WEB_VUL_SCANNER) {
                var userd_quantity = 0;
                var condition = 'select sum(present_quantity) as quantity from ?? where ??=? and ??=? and ??>?';
                var param = [];
                param.push('userid');
                param.push(data.USERID);
                param.push('object_type');
                param.push(data.PRODUCT_TYPE);
                param.push('create_time');
                param.push(event_start_time);
                if(event_end_time!=null){
                    condition += ' and ??<? ';
                    param.push('create_time');
                    param.push(event_end_time);
                }
                p.executeSql(condition)([Cashier.prototype.promotion_rules_detail_tableName].concat(param),function(ans){
                    if (ans.length > 0) {
                        if(ans[0].quantity == null){
                            userd_quantity = 0;
                        }else{
                            userd_quantity = parseInt(ans[0].quantity);
                        }
                    }else{
                        userd_quantity = 0;
                    }
                    if(userd_quantity > 0){
                        //to used
                        if(userd_quantity >= present_quantity){
                            user_price_quantity = 0;
                        }else{
                            user_price_quantity = 1;
                        }
                    }else{
                        //first used
                        user_price_quantity = 1;
                    }
                    f(rule_flag);
                },function(a){errorcallback(a), app.STD_END()});
            }else{
                //TODO
                f(rule_flag);
            }
        }else if(rule_flag && present_days > 0){
            if(data.PRODUCT_TYPE == p.product_type.VFW || data.PRODUCT_TYPE == p.product_type.LB){
                user_price_days = present_days;
                f(rule_flag);
            }else{
                var condition = 'select present_days from ?? where ??=? and ??=? and ??>?';
                var param = [];
                param.push('userid');
                param.push(data.USERID);
                param.push('object_type');
                param.push(data.PRODUCT_TYPE);
                param.push('create_time');
                param.push(event_start_time);
                if(event_end_time!=null){
                    condition += ' and ??<? ';
                    param.push('create_time');
                    param.push(event_end_time);
                }
                p.executeSql(condition)([Cashier.prototype.promotion_rules_detail_tableName].concat(param),function(ans){
                    if (ans.length == 0) {
                        user_price_days = present_days;
                    }else{
                        user_price_days = 0;
                    }
                    f(rule_flag);
                },function(a){errorcallback(a), app.STD_END()});
            }
        }else{
            f(rule_flag);
        }
    })
    flow_steps.push(function(rule_flag, f) {
        if (data.PRODUCT_TYPE == p.product_type.VM) {
            body.CPU = data.CPU;
            body.MEMORY = data.MEMORY/1024;
            body.DISK = data.DISK;
            body.DOMAIN = data.DOMAIN;
            p.callCashier('/plans', 'post', body, function(sCode, res) {
                if (res.OPT_STATUS == 'SUCCESS') {
                    response.OPT_STATUS = res.OPT_STATUS;
                    response.DATA.CHARGE_MODE = res.DATA.CHARGE_MODE;
                    response.DATA.PRICE = res.DATA.PRICE;
                    response.DATA.RULE_FLAG = rule_flag;
                    if(!rule_flag){
                        user_price_quantity = 0;
                        user_present_quantity = 0;
                        promotion_rules_id = 0;
                    }
                    response.DATA.PROMOTION_RULES_ID = promotion_rules_id;
                    response.DATA.USER_PRESENT_QUANTIY = user_present_quantity;
                    response.DATA.USER_PRICE_QUANTIY = user_price_quantity;
                    response.DATA.USER_PRICE_DAYS = user_price_days;
                } else {
                    logger.info('get %s price failed', data.lcuuid);
                }
                callback(response);
            },function() {
                logger.info('callCashier %s failed', data.lcuuid);
                callback(response);
            })
        } else {
            var key,value;
            if (data.PRODUCT_TYPE == p.product_type.SNAPSHOT){
                body.QUANTITY = data.SIZE;
                key = 'product_type';
                value = '11';
            }else if (data.PRODUCT_TYPE == p.product_type.BW) {
                body.QUANTITY = data.BW;
                key = 'lcuuid';
                value = data.product_specification_lcuuid;
            }else {
                body.QUANTITY = 1;
                key = 'lcuuid';
                value = data.product_specification_lcuuid;
            }
            p.selectSql([p.product_spec_tableName, key,value],function(ans){
                if (ans.length > 0) {
                    body.NAME = ans[0].plan_name;
                    body.DOMAIN = data.DOMAIN;
                    p.callCashier('/prices', 'post', body,
                        function(sCode, res) {
                            if (res.OPT_STATUS == 'SUCCESS') {
                                response.OPT_STATUS = res.OPT_STATUS;
                                response.DATA.CHARGE_MODE = res.DATA.CHARGE_MODE;
                                response.DATA.PRICE = res.DATA.PRICE;
                                response.DATA.RULE_FLAG = rule_flag;
                                if(!rule_flag){
                                    if('TOTAL_SIZE' in data){
                                        user_price_quantity = data.TOTAL_SIZE;
                                    }else{
                                        user_price_quantity = 0;
                                    }
                                    user_present_quantity = 0;
                                    promotion_rules_id = 0;
                                }
                                response.DATA.PROMOTION_RULES_ID = promotion_rules_id;
                                response.DATA.USER_PRESENT_QUANTIY = user_present_quantity;
                                response.DATA.USER_PRICE_QUANTIY = user_price_quantity;
                                response.DATA.USER_PRICE_DAYS = user_price_days;
                            } else {
                                logger.info('get snapshot price failed');
                            }
                            callback(response);
                        },function() {
                            logger.info('callCashier failed for snapshot');
                            callback(response);
                        })
                } else {
                    logger.info('snapshot product_specification not found');
                    callback(response);
                }
            },function() {
                logger.info('select snapshot product_specification failed');
                callback(response);
            })
        }
    })
    app.fire('', function(){logger.info('get_charge_info continue finished.');});
}

module.exports = Cashier;
