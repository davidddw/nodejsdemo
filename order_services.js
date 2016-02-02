var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var atry = require('./mydomain.js')
var constr = require('./const.js');
var balance = require('./balance.js');
var VulScanner = require('./vul_scanner.js');
var NasStorage = require('./nas_storage.js');
var Backup = require('./backup.js');
var OrderServices = function() {Obj.call(this);}

util.inherits(OrderServices, Obj);

OrderServices.prototype.user_tableName = 'fdb_user_v2_2';

OrderServices.prototype.create_services = function(data, callback, errorcallback) {
    var i;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var p = this;
    data.OPT_STATUS = constr.OPT.SUCCESS;

    atry(function(){
        flow_steps.push(function(a, f){
            if('SCANNERS' in data){
                var condition = 'select session,useruuid from ?? where ??=?';
                p.executeSql(condition)([OrderServices.prototype.user_tableName, 'id', data['USERID']],function(ans){
                    if (ans != null && ans.length > 0){
                        data['USERUUID'] = ans[0].useruuid;
                        p.callCharge('/balance-checks', 'post', data, function(resp){
                        f(a);
                            },function() {
                                logger.debug('check scanner balance failed');
                                errorcallback(402, {OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE,ERR_MSG : 'check scanner balance failed'});
                                app.STD_END();
                        });
                    }
                }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'change userid to useruuid failed'});app.STD_END()});
            }
            if ('NAS' in data) {
                var condition = 'select session,useruuid from ?? where ??=?';
                p.executeSql(condition)([OrderServices.prototype.user_tableName, 'id', data['USERID']],function(ans){
                    if (ans != null && ans.length > 0){
                        data['USERUUID'] = ans[0].useruuid;
                        p.callCharge('/balance-checks', 'post',data,function(resp){
                        f(a);
                            },function() {
                                logger.debug('check nas balance failed');
                                errorcallback(402, {OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE,ERR_MSG : 'check nas balance failed'});
                                app.STD_END();
                        });
                    }
                }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'change userid to useruuid failed'});app.STD_END()});
            }

            if ('BACKUP' in data) {
                var condition = 'select session,useruuid from ?? where ??=?';
                p.executeSql(condition)([OrderServices.prototype.user_tableName, 'id', data['USERID']],function(ans){
                    if (ans != null && ans.length > 0){
                        data['USERUUID'] = ans[0].useruuid;
                        p.callCharge('/balance-checks', 'post',data,function(resp){
                        f(a);
                            },function() {
                                logger.debug('check backup balance failed');
                                errorcallback(402, {OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE,ERR_MSG : 'check backup balance failed'});
                                app.STD_END();
                        });
                    }
                }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'change userid to useruuid failed'});app.STD_END()});
            }
        });

        flow_steps.push(function(a, f) {
            if('SCANNERS' in data){
                var vul_scanner = new VulScanner();
                for (i = 0; i < data.SCANNERS.length; ++i) {
                    var scanners_data = data.SCANNERS[i];
                    logger.info('create scanners started orderid is ',data.ORDER_ID);
                    var scanners = {vm_lcuuid: scanners_data.VM_LCUUID,task_type: scanners_data.TASK_TYPE,
                                    userid: data.USERID,order_id: data.ORDER_ID,scan_target:scanners_data.SCAN_TARGET,
                                    product_specification_lcuuid: scanners_data.PRODUCT_SPECIFICATION_LCUUID,
                                    domain:scanners_data.DOMAIN};
                    vul_scanner.create(scanners, callback, errorcallback);
                    logger.info('create scanners end orderid is ',data.ORDER_ID);
                }
            }
            if('NAS' in data){
                var nas_storage = new NasStorage();
                for (i = 0; i < data.NAS.length; ++i) {
                    var nas_data = data.NAS[i];
                    logger.info('create nas started orderid is ',data.ORDER_ID);
                    var nas = {NAME: nas_data.NAME,PATH: '--',TOTAL_SIZE: nas_data.TOTAL_SIZE,
                               PROTOCOL: nas_data.PROTOCOL,VENDOR:nas_data.VENDOR,DOMAIN: nas_data.DOMAIN,
                               USERID:data.USERID,ORDER_ID:data.ORDER_ID,operator_name : data.operator_name,
                               PRODUCT_SPECIFICATION_LCUUID:nas_data.PRODUCT_SPECIFICATION_LCUUID};
                    nas_storage.create(nas, callback, errorcallback);
                    logger.info('create nas end orderid is ',data.ORDER_ID);
                }
            }
            if('BACKUP' in data){
                var backup = new Backup();
                for (i = 0; i < data.BACKUP.length; ++i) {
                    var backup_data = data.BACKUP[i];
                    logger.info('create backup space started orderid is ',data.ORDER_ID);
                    var backup_space = {TOTAL_SIZE:backup_data.TOTAL_SIZE,DOMAIN: backup_data.DOMAIN,
                               USERID:data.USERID,ORDER_ID:data.ORDER_ID,operator_name : data.operator_name,
                               PRODUCT_SPECIFICATION_LCUUID:backup_data.PRODUCT_SPECIFICATION_LCUUID};
                    backup.create_spaces(backup_space, callback, errorcallback);
                    logger.info('create backup space end orderid is ',data.ORDER_ID);
                }
            }
        })
    }).catch(function(err){
         data.OPT_STATUS = constr.OPT.FAIL;
    });
    app.fire('',function() {logger.info('service order_id', data.ORDER_ID, 'create finished.');});
}

module.exports = OrderServices;
