var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var Instance = require('./instance.js');
var operationLog = require('./operation_log.js');
var constr = require('./const.js');
var Domain = require('./domain.js');
var Cashier = require('./cashier.js');

var Vwaf = function(){
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
util.inherits(Vwaf, Obj);

Vwaf.prototype.tableName = 'vm_v2_2';


Vwaf.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    p.selectSql([p.tableName, 'id', data.id],function(vwaf_ans) {
        if (vwaf_ans.length > 0){
            data.lcuuid = vwaf_ans[0].lcuuid;
            data.product_specification_lcuuid = vwaf_ans[0].product_specification_lcuuid;
            data.DOMAIN = vwaf_ans[0].domain;
            p.data = data;
            data.PRODUCT_TYPE = 'vwaf';

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

Vwaf.prototype.start_charge_handler = function(callback, errorcallback) {
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
        p.sendData('/v1/charges/vwafs/' + p.data.lcuuid , 'post', filter,function(sCode,data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                logger.debug('add vwaf charge record success');
                callback();
            } else {
                logger.debug('add vwaf charge record failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add vwaf charge record failed'});
            }
        },function() {
            logger.error('add vwaf charge request failed');
            errorcallback(500, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add vwaf charge record failed'});
        });
    }

    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);
}



Vwaf.prototype.stop_charge = function(data, callback) {
    var p = this;
    var lcuuid = '';
    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    p.sendData('/v1/charges/vwafs/' + lcuuid, 'delete', {},
        function(sCode, rdata) {callback(rdata);
    }, errorcallback);
}

module.exports=Vwaf;
