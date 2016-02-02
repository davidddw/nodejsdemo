var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var Vm = require('./vm.js');
var uuid = require('node-uuid');
var Domain = require('./domain.js')
var Cashier = require('./cashier.js');

var VulScanner = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'lcuuid',
        'vm_lcuuid',
        'vm_service_ip',
        'task_type',
        'userid',
        'order_id',
        'start_time',
        'product_specification_lcuuid',
        'scan_target',
        'domain',
    ];
}
util.inherits(VulScanner, Obj);

VulScanner.prototype.tableName = 'vul_scanner_v2_2';
VulScanner.prototype.tableservicevendor = 'service_vendor_v2_2';
VulScanner.prototype.promotion_rules_detail_tableName = 'promotion_rules_detail';
VulScanner.prototype.type = 'vul_scanner';
VulScanner.prototype.constructor = VulScanner;
VulScanner.prototype.task_type = {
    SYSTEM : 1,
    WEB : 2
};
VulScanner.prototype.requiredApiData = {
    VM_LCUUID: 'vm_lcuuid',
    SCAN_TARGET: 'scan_target',
    TASK_TYPE: 'task_type',
    USERID: 'userid',
    ORDER_ID: 'order_id',
    PRODUCT_SPECIFICATION_LCUUID: 'product_specification_lcuuid',
    DOMAIN: 'domain',
};

VulScanner.prototype.checkApiCreateData = function(data, errorcallback) {
    var p = this;
    var required = this.requiredApiData;
    if (!(required.TASK_TYPE in data)) {
        errorcallback(400, {ERR_MSG:'task_type is not specified'});
        return false;
    } else {
        if ((data[required.TASK_TYPE] != p.task_type.SYSTEM) &&
            (data[required.TASK_TYPE] != p.task_type.WEB)) {
            errorcallback(400, {ERR_MSG:'unknown task_type value'});
            return false;
        }
        else if (data[required.TASK_TYPE] == p.task_type.SYSTEM){
            if (!(required.VM_LCUUID in data)) {
                errorcallback(400, {ERR_MSG:'vm_lcuuid is not specified'});
                return false;
            }
        }
        else if (data[required.TASK_TYPE] == p.task_type.WEB){
            if (!(required.SCAN_TARGET in data)) {
                errorcallback(400, {ERR_MSG:'scan_target is not specified'});
                return false;
            }
        }
    }
    if (!(required.USERID in data)) {
        errorcallback(400, {ERR_MSG:'userid is not specified'});
        return false;
    }
    if (!(required.ORDER_ID in data)) {
        errorcallback(400, {ERR_MSG:'order_id is not specified'});
        return false;
    }
    if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
        errorcallback(400, {ERR_MSG:'product_specification_lcuuid is not specified'});
        return false;
    }

    if (!(required.DOMAIN in data)) {
        errorcallback(400, {ERR_MSG:'domain is not specified'});
        return false;
    }
    return true;
}

VulScanner.prototype.parseApiToDbData = function(data) {
    var ans = {};
    var cols = this.tableCols;
    for (var i=0; i<cols.length; i++) {
        if (cols[i] in data) {
            ans[cols[i]] = data[cols[i]];
        }
    }
    ans['lcuuid'] = uuid.v4();

    return ans;
}

VulScanner.prototype.newcallback = function(result, rCode, errmsg) {
    if (result) {
        res = {};
        res.OPT_STATUS = 'SUCCESS';
        res.DESCRIPTION = '';
        callback(res);
    } else{
        errorcallback(rCode, errmsg)
    }
}

VulScanner.prototype.get = function(data, callback, errorcallback){
    var p = this;

    var condition = 'select * from ?? where true';
    var param = [];
    var flow_steps = [];
    var vul_scanners = [];
    var app = new flow.serial(flow_steps);

    if ('task_type' in data) {
        condition += ' and ??=?';
        param.push('task_type');
        param.push(data.task_type);
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

    if ('domain' in data) {
        condition += ' and ??=?';
        param.push('domain');
        param.push(data.domain);
    }

    if ('id' in data) {
        condition += ' and ??=?';
        param.push('id');
        param.push(data.id);
    }

    var rdata = {};
    rdata.OPT_STATUS = 'SUCCESS';
    rdata.DESCRIPTION = '';
    rdata.TYPE = 'VUL_SCANNER';
    rdata.PAGE = {}

    if ('page_index' in data && 'page_size' in data) {
        if (data.page_index == '' || data.page_index == null || data.page_index == undefined || data.page_index <= 0) {
            data.page_index = 1;
        }
        if (data.page_size == '' || data.page_size == null || data.page_size == undefined || data.page_size <= 0) {
           data.page_size = DEFAULT_PAGE_SIZE;
        }
        var page_offset = (data.page_index - 1) * data.page_size;
        condition_page = condition + ' limit ' + page_offset + ', ' + data.page_size;
        rdata.PAGE.INDEX = data.page_index;
        rdata.PAGE.SIZE = data.page_size;
    }

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            [VulScanner.prototype.tableName].concat(param),
            function(ans){
                if (ans.length > 0) {
                    vul_scanners = ans;
                }
                if ('page_index' in data && 'page_size' in data) {
                    rdata.PAGE.TOTAL = Math.ceil(vul_scanners.length/data.page_size);
                }
                f(vul_scanners);
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });

    if ('page_index' in data && 'page_size' in data) {
        flow_steps.push(function(a, f){
            p.executeSql(condition_page)(
                [VulScanner.prototype.tableName].concat(param),
                function(ans){
                    if (ans.length > 0) {
                        vul_scanners = ans;
                    } else {
                        vul_scanners = [];
                    }
                    f(vul_scanners);
                },
                function(a){errorcallback(a), app.STD_END()}
            );
        });
    }

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    if ('task_type' in data && data['task_type'] == 2){
        flow_steps.push(function(a, f){
            for (var i = 0; i < vul_scanners.length; i++) {
                vul_scanners[i].start_time = vul_scanners[i].start_time.toMysqlFormat();
            }
            rdata.DATA = vul_scanners;
            callback(rdata);
            f(a);
        })
    } else {
        flow_steps.push(function(a, f){
            var vm = new Vm();
            var index = 0;

            if (vul_scanners.length == 0){
                if ('id' in data){
                    errorcallback(404);
                }
                else{
                    rdata.DATA = [];
                    callback(rdata);
                }
            } else if ('task_type' in data && data['task_type'] == 2){
                rdata.DATA = vul_scanners;
                callback(rdata);
                f(a);
            }

            for (var i = 0; i < vul_scanners.length; i++) {
                var filter = {};
                filter.lcuuid = vul_scanners[i].vm_lcuuid;
                vul_scanners[i].start_time = vul_scanners[i].start_time.toMysqlFormat();

                (function(i){
                    vm.get(filter,
                        function(resdata){
                            vul_scanners[i].vm = resdata.DATA;
                            index ++;
                            if (index == vul_scanners.length) {
                                if ('id' in data){
                                    rdata.DATA = vul_scanners[0];
                                }
                                else{
                                    rdata.DATA = vul_scanners;
                                }
                                callback(rdata);
                            }
                        },
                        function(){}
                    );
                })(i)
            }
        });

    }

        app.fire('', function(){});
}

VulScanner.prototype.getvms = function(data, callback, errorcallback){
    var p = this;

    var condition = 'select * from ?? where true';
    var param = [];
    var vul_scanners = [];
    var vul_scanners_vms = [];
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    if ('task_type' in data) {
        condition += ' and ??=?';
        param.push('task_type');
        param.push(data.task_type);
    }

    if ('userid' in data) {
        condition += ' and ??=?';
        param.push('userid');
        param.push(data.userid);
    }

    condition += ' group by vm_lcuuid';

    flow_steps.push(function(a, f){
        p.executeSql(condition)(
            [VulScanner.prototype.tableName].concat(param),
            function(ans){
                if (ans.length > 0) {
                    vul_scanners = ans;
                }
                f(a);
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });

    flow_steps.push(function(a, f){
        var filter = {};
        var i = 0;
        var index = 0;
        var vm = new Vm();
        var check_res = 0;
        var check_if_callback = function(index, len) {
            index++;
            if (index == len) {
                return true;
            }
            return false;
        }

        for (i = 0; i < vul_scanners.length; i++) {
            filter.lcuuid = vul_scanners[i].vm_lcuuid;
            vm.get(filter,
                   function(rdata){
                       vul_scanners_vms.push(rdata.DATA);
                       check_res = check_if_callback(index, vul_scanners.length);
                       if (check_res) {
                           f(a);
                       }
                   },
                   function(){
                       check_res = check_if_callback(index, vul_scanners.length);
                       if (check_res) {
                           f(a);
                       }
                   }
            );
        }
    });

    flow_steps.push(function(a, f){
        var rdata = {};

        rdata.OPT_STATUS = 'SUCCESS';
        rdata.DESCRIPTION = '';
        rdata.TYPE = 'VM';
        rdata.DATA = vul_scanners_vms;
        callback(rdata);
    });

    app.fire('', function(){});
}

VulScanner.prototype.getreport = function(data, callback, errorcallback) {
    var p = this;
    var url = '';
    p.selectSql([p.tableName, 'lcuuid', data.lcuuid],function(ans) {
        if (ans.length > 0){
            p.selectSql([p.tableservicevendor, 'service_ip', ans[0].service_vendor_ip],function(vendor_ans) {
               if (vendor_ans.length > 0){
                  url = 'https://' + vendor_ans[0].service_ip + ':' + vendor_ans[0].service_port + '/httpRpc/getTaskReport?user=' + vendor_ans[0].service_user_name + '&password=' + vendor_ans[0].service_user_passwd + '&id=' + ans[0].task_id;
                  callback({OPT_STATUS: 'SUCCESS', URL: url})
               } else {
                   errorcallback(404);
               }
            },errorcallback);
        } else{
            errorcallback(404);
        }
    },errorcallback);
}

VulScanner.prototype.create = function(data, callback, errorcallback) {
    logger.debug('Adding vul_scanner service');
    var p = this;
    var i = 0;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    var check_res = p.checkApiCreateData(data, errorcallback);
    if (!check_res) {
        logger.info('Add vul_scanner request check failed');
        return;
    }

    if (data['task_type'] == p.task_type.SYSTEM){
        flow_steps.push(function(a, f){
            p.sendData('/v1/vms/' + data['vm_lcuuid'] + '/interfaces/5',
                       'put',
                       {"state":1, "if_type":"SERVICE"},
                       function(sCode, rdata) {
                           if (rdata.OPT_STATUS == 'SUCCESS') {
                               if ((1 == rdata.DATA.INTERFACES[0].STATE) &&
                                   ('SERVICE' in rdata.DATA.INTERFACES[0])) {
                                   data['vm_service_ip'] = rdata.DATA.INTERFACES[0].SERVICE.IP;
                                   f(a);
                               } else {
                                   logger.info('Attach service interface failed');
                                   errorcallback(500, {ERR_MSG:'Attach service interface failed'});
                                   app.STD_END();
                               }
                           } else {
                               logger.info('Attach service interface failed');
                               errorcallback(500, {ERR_MSG:'Attach service interface failed'});
                               app.STD_END();
                           }
                        },
                        function(sCode, rdata){errorcallback(sCode, rdata), app.STD_END()}
            );
        });
    }

    flow_steps.push(function(a, f){
        var dbdata = p.parseApiToDbData(data, p.task_type.SYSTEM);
        p.insertSql(
            [p.tableName, dbdata],
            function(ans) {
                var res = {};
                res.id = ans.insertId;
                res.OPT_STATUS = 'SUCCESS';
                res.DESCRIPTION = '';
                callback(res);
                p.sendToMsgCenter(
                    {type:'user',
                     target:data.userid,
                     msg:{action:'create', state:'done', type:'vul_scanner', id:ans.insertId, data:dbdata}});
            },
            errorcallback
        );
    });

    app.fire('', function(){});
}

VulScanner.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    p.selectSql([p.tableName, 'id', data.id],function(vul_ans) {
        if (vul_ans.length > 0){
            if (vul_ans[0].task_type == p.task_type.SYSTEM) {
                vul_ans[0].type = 'sys-vul-scanners';
                data.PRODUCT_TYPE = 'sys-vul-scanner';
            } else if (vul_ans[0].task_type == p.task_type.WEB) {
                vul_ans[0].type = 'web-vul-scanners';
                data.PRODUCT_TYPE = 'web-vul-scanner';
            } else {
                errorcallback(400, {ERR_MSG:'unknown task_type'});
            }
            data.USERID = vul_ans[0].userid;
            data.lcuuid = vul_ans[0].lcuuid;
            data.product_specification_lcuuid = vul_ans[0].product_specification_lcuuid;
            data.DOMAIN = vul_ans[0].domain;
            data.type = vul_ans[0].type;
            p.data = data;

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

VulScanner.prototype.start_charge_handler = function(callback, errorcallback) {
    var p = this;

    var cashierCallback = function(rdata){
        var filter = {};
        if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
            filter.CHARGE_MODE = rdata.DATA.CHARGE_MODE;
            if(rdata.DATA.USER_PRICE_QUANTIY==1){
                filter.PRICE = 0;
            }else{
                filter.PRICE = rdata.DATA.PRICE;
            }
            filter.PRESENT_DAYS = rdata.DATA.USER_PRICE_DAYS;
            filter.PRICE_QUANTITY = rdata.DATA.USER_PRICE_QUANTIY;
        }else{
            errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get charge_mode and price is not specified'});
            return;
        }
        p.sendData('/v1/charges/'+ p.data.type +'/' + p.data.lcuuid , 'post', filter,function(sCode,data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                if(rdata.DATA.RULE_FLAG && rdata.DATA.USER_PRICE_QUANTIY == 1){
                    var condition_insert = "INSERT INTO ?? (promotion_rules_id,object_type,object_lcuuid,present_days,present_quantity,userid)values(?,?,?,?,?,?);";
                    var param_insert = [VulScanner.prototype.promotion_rules_detail_tableName];
                    param_insert.push(rdata.DATA.PROMOTION_RULES_ID);
                    param_insert.push(p.data.PRODUCT_TYPE);
                    param_insert.push(p.data.lcuuid);
                    param_insert.push(rdata.DATA.USER_PRICE_DAYS);
                    param_insert.push(rdata.DATA.USER_PRICE_QUANTIY);
                    param_insert.push(p.data.USERID);
                    p.executeSql(condition_insert)(param_insert, function(rdata){},errorcallback);
                }
                logger.debug('start '+ p.data.type +' charge success');
                callback();
            } else {
                logger.debug('start '+ p.data.type +' charge failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add '+ p.data.type +' charge record failed'});
            }
        },function() {
            logger.debug('start '+ p.data.type +' charge failed');
            callback(false, 500, {ERR_MSG:'start '+ p.data.type +' failed'});
        });
    }

    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);
}

VulScanner.prototype.start_sys_charge_handler = function(data, callback) {
    var p = this;
    p.sendData('/v1/charges/sys-vul-scanners/' + data.lcuuid,'post','',function(sCode, data) {
        if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
           logger.debug('start sys_vul_scanner charge success');
           callback(true);
        } else {
           logger.debug('start sys_vul_scanner charge failed');
           callback(false, sCode, data);
        }
    },function() {
        logger.debug('start sys_vul_scanner charge failed');
        callback(false, 500, {ERR_MSG:'start sys_vul_scanner failed'});
    });
}

VulScanner.prototype.start_web_charge_handler = function(data, callback) {
    var p = this;
    p.sendData('/v1/charges/web-vul-scanners/' + data.lcuuid,'post','',function(sCode, data) {
        if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
            logger.debug('start web_vul_scanner charge success');
            callback(true);
        } else {
            logger.debug('start web_vul_scanner charge failed');
            callback(false, sCode, data);
        }
    },function() {
        logger.debug('start web_vul_scanner charge failed');
        callback(false, 500, {ERR_MSG:'start web_vul_scanner failed'});
    });
}

module.exports=VulScanner;
