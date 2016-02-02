var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var uuid = require('node-uuid');
var Vm =require('./vm.js');
var operationLog = require('./operation_log.js');
var executor=require('child_process');
var user = require('./user.js');
var constr = require('./const.js');
var Domain = require('./domain.js')
var balance = require('./balance.js');
var Cashier = require('./cashier.js');

var NasStorage = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'lcuuid',
        'vm_lcuuid',
        'vm_service_ip',
        'path',
        'total_size',
        'available_size',
        'userid',
        'order_id',
        'start_time',
        'product_specification_lcuuid',
        'domain',
    ];
}
util.inherits(NasStorage, Obj);

NasStorage.prototype.tableName = 'nas_storage_v2_2';
NasStorage.prototype.user_tableName = 'fdb_user_v2_2';
NasStorage.prototype.promotion_rules_detail_tableName = 'promotion_rules_detail';
NasStorage.prototype.type = 'nas_storage';
NasStorage.prototype.constructor = NasStorage;
NasStorage.prototype.requiredApiData = {
    NAME: 'NAME',
    PATH: 'PATH',
    TOTAL_SIZE: 'TOTAL_SIZE',
    PROTOCOL:'PROTOCOL',
    VENDOR:'VENDOR',
    USERID: 'USERID',
    ORDER_ID: 'ORDER_ID',
    SERVICE_VENDOR_LCUUID: 'SERVICE_VENDOR_LCUUID',
    PRODUCT_SPECIFICATION_LCUUID: 'PRODUCT_SPECIFICATION_LCUUID',
    DOMAIN: 'DOMAIN',
};

NasStorage.prototype.vinterface_tbl = 'vinterface_v2_2';
NasStorage.prototype.vm_tbl = 'vm_v2_2';
NasStorage.prototype.fdb_user_tbl = 'fdb_user_v2_2';
NasStorage.prototype.nas_storage_plug_info_tbl = 'nas_storage_plug_info_v2_2';
NasStorage.prototype.mail_plug_subject = 'NAS存储白名单设置失败';
NasStorage.prototype.mail_plug_notice = ' 有相同内容的工单发送给管理员，请您及时处理。'
NasStorage.prototype.mail_unplug_subject = 'NAS存储白名单解除设置失败';
NasStorage.prototype.mail_modify_subject = 'NAS存储扩容操作失败';
NasStorage.prototype.mail_delete_subject = 'NAS存储删除操作失败';
NasStorage.prototype.mail_from = 'stats@yunshan.net.cn';
NasStorage.prototype.admin_index = 1;
NasStorage.prototype.vm_service_ifindex = 5;
NasStorage.prototype.vm_devicetype_index = 1;

NasStorage.prototype.sendPlugMail = function(nas_lcuuid, vm_lcuuid) {
    logger.info('creating mail nas plug content ');
    var p = this;
     p.selectSql(
         [p.fdb_user_tbl, 'id', p.admin_index],
         function(rdata){
             if(rdata.length){
                 p.createMailPlugContent(nas_lcuuid, vm_lcuuid, function(ans){
                     if (ans != null && ans != '' && ans != undefined){
                         var cmd = '/usr/local/livecloud/bin/postman/cli.py --priority=9 --to=' + rdata[0].email
                             + ' --mail_type=9  --raw_string=\'' + ans + '\' --subject=' + p.mail_plug_subject
                             + ' --from=' + p.mail_from + ' --event_type=15 --resource_type=7 --resource_id=1 > /dev/null 2>&1';
                         logger.info(cmd);
                         executor.exec( cmd , function(err, stdout , stderr ) {
                             logger.info(stdout);
                         });
                     }
                     else {
                         logger.error('createMailPlugContent fail.');
                     }
                 });
           }
           else {
           }
       }, function(){});
}

NasStorage.prototype.createMailPlugContent = function(nas_lcuuid, vm_lcuuid, callback) {
    logger.debug('creating mail nas plug content ');
    var p = this;
    var content = '';

     p.selectSql(
         [p.tableName, 'lcuuid', nas_lcuuid],
         function(nas_rdata){
           if (nas_rdata.length){
             p.selectSql(
               [p.fdb_user_tbl, 'id', nas_rdata[0].userid],
               function(user_rdata){
                 if (user_rdata.length) {
                   content += '用户：' + user_rdata[0].username + '； \n';
                   content += '访问路径：' + nas_rdata[0].path + '； \n';
                   content += '协议：' + nas_rdata[0].protocol + '； \n';
                   p.selectSql(
                     [p.vm_tbl, 'lcuuid', vm_lcuuid],
                     function(vm_rdata){
                       if (vm_rdata.length) {
                         p.vm_name = vm_rdata[0].name;
                         content += '虚拟主机：' + vm_rdata[0].name + '； \n';
                         var condition = 'select * from ?? where ??=? and ??=? and ??=?';
                         var param = [p.vinterface_tbl];
                         param.push('deviceid');
                         param.push(vm_rdata[0].id);
                         param.push('devicetype');
                         param.push(p.vm_devicetype_index);
                         param.push('ifindex');
                         param.push(p.vm_service_ifindex);
                         p.executeSql(condition)(
                           param,
                           function(vinterface_rdata){
                             if (vinterface_rdata.length) {
                               if (vinterface_rdata[0].ip == null || vinterface_rdata[0].ip == undefined  || vinterface_rdata[0].ip == '') {
                                 content += 'IP：未配置' + '； \n';
                                 logger.info(content);
                                 callback(content);
                               } else {
                                 content += 'IP：' + vinterface_rdata[0].ip + '； \n';
                                 logger.info(content);
                                 callback(content);
                               }
                             } else {
                               logger.error('vm %s service ip not exist in db', vm_lcuuid);
                               content += 'IP：未配置' + '； \n';
                               callback(content);
                             }
                           }, function(){});
                       } else {
                         logger.error('vm %s not exist in db', vm_lcuuid);
                         callback('');
                       }
                     }, function(){});
                 } else {
                   logger.error('user %s not exist in db', nas_rdata[0].userid);
                   callback('');
                 }
             }, function(){});
           } else {
             logger.error('nas %s not exist in db', nas_lcuuid);
             callback('');
           }
         }, function(){});

}

NasStorage.prototype.sendModifyMail = function(nas_lcuuid, total_size) {
    logger.debug('creating mail nas modify content ');
    var p = this;
    p.selectSql(
        [p.fdb_user_tbl, 'id', p.admin_index],
        function(rdata){
            if(rdata.length){
                p.createMailModifyContent(nas_lcuuid, total_size, function(ans){
                    if (ans != null && ans != '' && ans != undefined){
                        var cmd = '/usr/local/livecloud/bin/postman/cli.py --priority=9 --to=' + rdata[0].email
                            + ' --mail_type=9  --raw_string=\'' + ans + '\' --subject=' + p.mail_modify_subject
                            + ' --from=' + p.mail_from + ' --event_type=15 --resource_type=7 --resource_id=1 > /dev/null 2>&1';
                        logger.info(cmd);
                        executor.exec( cmd , function(err, stdout , stderr ) {
                            logger.info(stdout);
                        });
                    }
                    else {
                        logger.error('sendModifyMail fail.');
                    }
                });
            }
            else {
            }
        }, function(){});
}

NasStorage.prototype.createMailModifyContent = function(nas_lcuuid, total_size, callback) {
    logger.debug('creating mail nas modify content ');
    var p = this;
    var content = '';
     p.selectSql(
         [p.tableName, 'lcuuid', nas_lcuuid],
         function(nas_rdata){
             if (nas_rdata.length){
                 p.selectSql(
                    [p.fdb_user_tbl, 'id', nas_rdata[0].userid],
                    function(user_rdata){
                        if (user_rdata.length) {
                            content += '用户名称：' + user_rdata[0].username + ' ; \n';
                            content += 'NAS存储名称：' + nas_rdata[0].name + ' ; \n';
                            content += 'NAS存储目录：' + nas_rdata[0].path + ' ;  \n';
                            content += '扩容后总大小：' + total_size + 'G ; ';
                            callback(content);
                        } else {
                            logger.error('user %s not exist in db', nas_rdata[0].userid);
                            callback('');
                        }
                    }, function(){});
             } else {
                logger.error('nas %s not exist in db', nas_lcuuid);
                callback('');
             }
     }, function(){});
}

NasStorage.prototype.sendDeleteMail = function(path, userid) {
    logger.debug('creating mail nas delete content ');
    var p = this;
    p.selectSql(
        [p.fdb_user_tbl, 'id', p.admin_index],
        function(rdata){
            if(rdata.length){
                p.createMailDeleteContent(path, userid, function(ans){
                    if (ans != null && ans != '' && ans != undefined){
                        var cmd = '/usr/local/livecloud/bin/postman/cli.py --priority=9 --to=' + rdata[0].email
                            + ' --mail_type=9  --raw_string=\'' + ans + '\' --subject=' + p.mail_delete_subject
                            + ' --from=' + p.mail_from + ' --event_type=15 --resource_type=7 --resource_id=1 > /dev/null 2>&1';
                        logger.info(cmd);
                        executor.exec( cmd , function(err, stdout , stderr ) {
                           logger.info(stdout);
                        });
                    } else {
                        logger.error('sendDeleteMail fail.');
                    }
                });
            } else {
           }
       }, function(){});
}

 NasStorage.prototype.createMailDeleteContent = function(path, userid, callback) {
     logger.debug('creating mail nas delete content ');
     var p = this;
     var content = '';
     p.selectSql(
        [p.fdb_user_tbl, 'id', userid],
        function(user_rdata){
            if (user_rdata.length) {
                content += '用户名称：' + user_rdata[0].username + '； \n';
                content += 'NAS存储目录：' + path + '； \n';
                callback(content);
            } else {
                logger.error('user %s not exist in db', userid);
                callback('');
            }
        }, function(){});
}

NasStorage.prototype.sendUnplugMail = function(nas_lcuuid, vm_lcuuid) {
    logger.debug('creating mail nas unplug content ');
    var p = this;
     p.selectSql(
         [p.fdb_user_tbl, 'id', p.admin_index],
         function(rdata){
             if(rdata.length){
                 p.createMailUnplugContent(nas_lcuuid, vm_lcuuid, function(ans){
                     if (ans != null && ans != '' && ans != undefined){
                         var cmd = '/usr/local/livecloud/bin/postman/cli.py --priority=9 --to=' + rdata[0].email
                             + ' --mail_type=9  --raw_string=\'' + ans + '\' --subject=' + p.mail_unplug_subject
                             + ' --from=' + p.mail_from + ' --event_type=15 --resource_type=7 --resource_id=1 > /dev/null 2>&1';
                         logger.info(cmd);
                         executor.exec( cmd , function(err, stdout , stderr ) {
                             logger.info(stdout);
                         });
                     }
                     else {
                         logger.error('createMailUnplugContent fail.');
                     }
                 });
           }
           else {
           }
       }, function(){});
}

NasStorage.prototype.createMailUnplugContent = function(nas_lcuuid, connection_lcuuid, callback) {
    logger.debug('creating mail nas unplug content ');
    var p = this;
    var content = '';

     p.selectSql(
         [p.tableName, 'lcuuid', nas_lcuuid],
         function(nas_rdata){
           if (nas_rdata.length){
             p.selectSql(
               [p.fdb_user_tbl, 'id', nas_rdata[0].userid],
               function(user_rdata){
                 if (user_rdata.length) {
                   content += '用户名称：' + user_rdata[0].username + '； \n';
                   content += 'NAS存储目录：' + nas_rdata[0].path + '； \n';
                   p.selectSql(
                     [p.nas_storage_plug_info_tbl, 'lcuuid', connection_lcuuid],
                     function(plug_info_rdata){
                       if (plug_info_rdata.length) {
                         vm_lcuuid = plug_info_rdata[0].vm_lcuuid;
                         p.selectSql(
                           [p.vm_tbl, 'lcuuid', vm_lcuuid],
                           function(vm_rdata){
                             if (vm_rdata.length) {
                               content += 'VM名称：' + vm_rdata[0].name + '； \n';
                               var condition = 'select * from ?? where ??=? and ??=? and ??=?';
                               var param = [p.vinterface_tbl];
                               param.push('deviceid');
                               param.push(vm_rdata[0].id);
                               param.push('devicetype');
                               param.push(p.vm_devicetype_index);
                               param.push('ifindex');
                               param.push(p.vm_service_ifindex);
                               p.executeSql(condition)(
                                 param,
                                 function(vinterface_rdata){
                                   if (vinterface_rdata.length) {
                                     if (vinterface_rdata[0].ip == null || vinterface_rdata[0].ip == undefined  || vinterface_rdata[0].ip == '') {
                                       content += 'VM服务网段IP：未配置' + '； \n';
                                       logger.info(content);
                                       callback(content);
                                     } else {
                                       content += 'VM服务网段IP：' + vinterface_rdata[0].ip + '； \n';
                                       logger.info(content);
                                       callback(content);
                                     }
                                   } else {
                                     logger.error('vm %s service ip not exist in db', vm_lcuuid);
                                     content += 'VM服务网段IP：未配置' + '； \n';
                                     callback(content);
                                   }
                                 }, function(){});
                            } else {
                              logger.error('vm %s not exist in db', vm_lcuuid);
                              callback('');
                            }
                         }, function(){});
                       } else {
                         logger.error('connection_lcuuid ' + connection_lcuuid + ' not exist');
                         callback('');
                       }
                     }, function(){});
                 } else {
                   logger.error('user %s not exist in db', nas_rdata[0].userid);
                   callback('');
                 }
             }, function(){});
           } else {
             logger.error('nas %s not exist in db', nas_lcuuid);
             callback('');
           }
         }, function(){});

}

NasStorage.prototype.checkApiCreateData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.NAME in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_ALREADY_EXIST,DESCRIPTION: 'Resource already exist'});
        return false;
    }
    if (!(required.PATH in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'path is not specified'});
        return false;
    }
    if (!(required.TOTAL_SIZE in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'total_size is not specified'});
        return false;
    }
    if (!(required.PROTOCOL in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'protocol is not specified'});
        return false;
    }
    if (!(required.VENDOR in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'vendor is not specified'});
        return false;
    }
    if (!(required.USERID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'userid is not specified'});
        return false;
    }
    if (!(required.ORDER_ID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'order_id is not specified'});
        return false;
    }
    if (!(required.DOMAIN in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'domain is not specified'});
        return false;
    }
    if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'product_specification_lcuuid is not specified'});
        return false;
    }
    return true;
}

NasStorage.prototype.checkApiModifyData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.TOTAL_SIZE in data) || !(required.PATH in data && required.SERVICE_VENDOR_LCUUID in data)) {
        errorcallback(400, {ERR_MSG:'total_size or path service_vendor_lcuuid is not specified'});
        return false;
    }
    return true;
}

NasStorage.prototype.checkApiPlugData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!('lcuuid' in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'lcuuid is not specified'});
        return false;
    }
    if (!('VM_LCUUID' in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'vm_lcuuid is not specified'});
        return false;
    }
    return true;
}

NasStorage.prototype.checkApiUNPlugData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!('lcuuid' in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'lcuuid is not specified'});
        return false;
    }
    if (!('connection_lcuuid' in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'connection_lcuuid is not specified'});
        return false;
    }
    return true;
}

NasStorage.prototype.checkApiNotifyData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.PATH in data)) {
        errorcallback(400, {ERR_MSG:'path is not specified'});
        return false;
    }
    if (!(required.AVAILABLE_SIZE in data)) {
        errorcallback(400, {ERR_MSG:'available_size is not specified'});
        return false;
    }
    return true;
}

NasStorage.prototype.parseApiToDbData = function(data) {
    var ans = {};
    var cols = this.tableCols;
    for (var i=0; i<cols.length; i++) {
        if (cols[i] in data) {
            ans[cols[i]] = data[cols[i]];
        }
    }
    ans['available_size'] = data['total_size'];
    ans['lcuuid'] = uuid.v4();

    return ans;
}

NasStorage.prototype.newcallback = function(result, rCode, errmsg) {
    if (result) {
        res = {};
        res.OPT_STATUS = 'SUCCESS';
        res.DESCRIPTION = '';
        callback(res);
    } else{
        errorcallback(rCode, errmsg)
    }
}

NasStorage.prototype.get = function(data, callback, errorcallback){
    var p = this;
    var filter = {};
    var lcuuid = '';
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var response = {OPT_STATUS: constr.OPT.SUCCESS, DATA:[]};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('detail' in data) {
        filter.detail = data.detail;
    }
    if ('domain' in data) {
        filter.domain = data.domain;
    }
    if('order-id' in data){
        filter['order-id'] = data['order-id'];
    }
    if ('lcuuid' in data) {
        lcuuid = '/' + data.lcuuid;
    }
    flow_steps.push(function(a, f){
        p.sendData('/v1/nas-storages' + lcuuid , 'get', filter, function(sCode, rdata){
        response = rdata;
        f(response.DATA);
        }, errorcallback);
    });
    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(response);});
}

NasStorage.prototype.create = function(data, callback, errorcallback) {
    logger.info('Creating nas_storage service');
    var p = this;
    var check_res = p.checkApiCreateData(data, errorcallback);
    if (!check_res) {
        logger.info('Create request check failed')
        return;
    }
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    var nas_storage_lcuuid = '';
    p.sendData('/v1/nas-storages' , 'post', data, function(sCode, rdata){
        if('DATA' in rdata){
            nas_storage_lcuuid= rdata.DATA.LCUUID;
            operationLog.create_and_update({operation:'create', objecttype:'nas', objectid:rdata.DATA.ID,
                object_userid:data.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});

            var response = {OPT_STATUS: constr.OPT.SUCCESS, data:{}};
            var nas_charge = [{}];
            p.getSession(data.USERID, function(ans){
                if (ans != null && ans.length > 0) {
                    response.session = ans[0].session;
                    response.user_id = rdata.DATA.USERID;
                    response.order_id = data.ORDER_ID;
                    response.domain = rdata.DATA.DOMAIN;
                    response.autoconfirm = 1;
                    response.data.ORDER_ID = data.ORDER_ID;
                    response.data.USERID = rdata.DATA.USERID;
                    response.data.USERUUID = ans[0].useruuid;
                    response.data.DOMAIN = rdata.DATA.DOMAIN;
                    nas_charge[0].OBJ_LCUUID = rdata.DATA.LCUUID;
                    nas_charge[0].SIZE = rdata.DATA.TOTAL_SIZE;
                    nas_charge[0].PS_LCUUID = rdata.DATA.PRODUCT_SPECIFICATION_LCUUID;
                    nas_charge[0].NAME = rdata.DATA.NAME;
                    nas_charge[0].MDF_FLAG = false;
                    response.data.NAS = nas_charge;
                    response.data = JSON.stringify(response.data);
                    p.callbackWeb('/order/confirmorder', 'post',response,function(resp){
                        logger.info('order_id', data.ORDER_ID,'create continue since notify web finished:', arguments);
                    },function() {
                        logger.error('order_id', data.ORDER_ID,'create continue but notify web failed:', arguments);
                    });
                }
            },function(){logger.info('nas get session failed.');});
            callback(rdata);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
}

NasStorage.prototype.modify = function(data, callback, errorcallback) {
    logger.info('Modifying nas_storage service',data);
    var p = this;
    var filter = {};
    var nas_name;
    var nas_path;
    var lcuuid = '';
    var domain,userid,product_specification_lcuuid;
    var response = {opt_status: constr.OPT.SUCCESS, data:{}};
    var nas_charge = [{}];
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }else{
        errorcallback(400, {OPT_STATUS: constr.OPT.INSUFFICIENT_BALANCE,DESCRIPTION: constr.OPT_EN.INSUFFICIENT_BALANCE});
    }
    if ('TOTAL_SIZE' in data) {
        filter.TOTAL_SIZE = data.TOTAL_SIZE;
    }
    if ('PATH' in data) {
        filter.PATH = data.PATH;
    }
    if ('SERVICE_VENDOR_LCUUID' in data) {
        filter.SERVICE_VENDOR_LCUUID = data.SERVICE_VENDOR_LCUUID;
    }

    var condition = "select nas.domain,nas.userid,nas.product_specification_lcuuid,user.useruuid,user.session from ?? nas,?? user where nas.userid = user.id and nas.lcuuid=? ";
    var param = [NasStorage.prototype.tableName,NasStorage.prototype.user_tableName,lcuuid];

    flow_steps.push(function(a, f) {
        p.executeSql(condition)(param,function(nas_rdata){
            if (nas_rdata.length > 0){
                domain = nas_rdata[0].domain;
                userid = nas_rdata[0].userid;
                product_specification_lcuuid = nas_rdata[0].product_specification_lcuuid;
                response.session = nas_rdata[0].session;
                response.useruuid = nas_rdata[0].useruuid;
                f(a);
            } else{
                p.sendModifyMail(lcuuid, data.TOTAL_SIZE);
                errorcallback(404);
                app.STD_END();
            }
        },function(a){errorcallback(a);p.sendModifyMail(lcuuid, data.TOTAL_SIZE);})
    })
    flow_steps.push(function(flag, f) {
        p.sendData('/v1/nas-storages/'+ lcuuid , 'patch', filter, function(sCode, rdata){
            if('DATA' in rdata){
                var userid = rdata.DATA.USERID;
                if('NAME' in  rdata.DATA){
                    nas_name = rdata.DATA.NAME;
                }
                if('PATH' in  rdata.DATA){
                    nas_path = rdata.DATA.PATH;
                }
                response.user_id = userid;
                response.domain = domain;
                response.autoconfirm = 1;
                response.content = JSON.stringify({storage_mdf:[{content:'NAS存储['+ nas_name +']扩容到'+data.TOTAL_SIZE + 'G',path:nas_path,lcuuid:lcuuid}]});
                response.data.ORDER_ID = 0;
                response.data.USERID = userid;
                response.data.DOMAIN = domain;
                nas_charge[0].OBJ_LCUUID = lcuuid;
                nas_charge[0].SIZE = data.TOTAL_SIZE;
                nas_charge[0].PS_LCUUID = product_specification_lcuuid;
                nas_charge[0].NAME = nas_name;
                nas_charge[0].MDF_FLAG = true;
                response.data.NAS = nas_charge;
                p.getSession(userid, function(ans){
                    if (ans != null && ans.length > 0) {
                        response.session = ans[0].session;
                        response.data.USERUUID = ans[0].useruuid;
                        response.data = JSON.stringify(response.data);
                        p.callbackWeb('/order/addorder', 'post', response, function(sCode,order_data){
                            if (sCode == 200){
                                logger.info('modify insert into order success');
                                callback({OPT_STATUS: 'SUCCESS'});
                            }else{
                                p.sendModifyMail(lcuuid, data.TOTAL_SIZE);
                                errorcallback(sCode);
                            }
                        operationLog.create_and_update({operation:'update', objecttype:'nas', objectid:rdata.DATA.ID,
                                object_userid:userid, operator_name:data['operator_name'], opt_result:1}, function(){}, function(){});
                        },function() {
                            logger.error('modify insert into order failed');
                            p.sendModifyMail(lcuuid, data.TOTAL_SIZE);
                        });
                    }
                },function(){logger.info('nas get session failed.');});
            }else{
                p.sendModifyMail(lcuuid, data.TOTAL_SIZE);
                errorcallback(sCode);
            }
        },function(a,dataerror){errorcallback(dataerror);p.sendModifyMail(lcuuid, data.TOTAL_SIZE);});
    })
    app.fire('',function() {logger.info('nas modify finished.');});
}

NasStorage.prototype.plug = function(data, callback, errorcallback) {
    logger.info('Pluging nas_storage service',data);

    var p = this;
    var lcuuid = '';
    var vm_lcuuid = '';
    var filter = {};
    var userid = '';
    var objectid = '';
    var nas_path = '';
    var operator_name = data['operator_name'];

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    if ('VM_LCUUID' in data) {
        filter.VM_LCUUID = data.VM_LCUUID;
    }

    var check_res = p.checkApiPlugData(data, errorcallback);
    if (!check_res) {
        logger.info('Create request check failed')
        return;
    }

    delete data['operator_name'];

    flow_steps.push(function(a, f){
        p.sendData('/v1/vms/' + data['VM_LCUUID'] + '/interfaces/5','put',{"state":1, "if_type":"SERVICE"},function(sCode, rdata) {
            if (rdata.OPT_STATUS == 'SUCCESS') {
                logger.info('Attach service interface success');
                f(a);
            } else {
                logger.info('Attach service interface failed');
                p.sendPlugMail(lcuuid, data['VM_LCUUID']);
                errorcallback(500, {ERR_MSG:'Attach service interface failed'});
                app.STD_END();
            }
        },function(sCode, rdata){errorcallback(sCode, rdata);});
    });
    flow_steps.push(function(a, f){
        p.sendData('/v1/nas-storages/' + lcuuid , 'get', {}, function(sCode, rdata){
            if('DATA' in rdata){
                userid = rdata.DATA.USERID;
                objectid = rdata.DATA.ID;
                nas_path = rdata.DATA.PATH;
                f(a);
            }else{
                p.sendPlugMail(lcuuid, data['VM_LCUUID']);
                errorcallback(sCode);
                app.STD_END();
            }
        }, errorcallback);
    });

    flow_steps.push(function(a, f){
        p.sendData('/v1/nas-storages/'+ lcuuid+'/connection', 'post', filter,function(sCode, rdata){
            if ('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS') {
                callback(rdata);
                operationLog.create_and_update({operation:'plug', objecttype:'nas', objectid:objectid,
                    object_userid:userid, operator_name:operator_name, opt_result:1}, function(){}, function(){});
            }else{
                p.sendPlugMail(lcuuid, data['VM_LCUUID']);
                errorcallback(400, {OPT_STATUS: constr.OPT.SERVER_ERROR_TRY_AGAIN,DESCRIPTION: constr.OPT_EN.SERVER_ERROR_TRY_AGAIN});
                app.STD_END();
            }
        }, function(a, dataerror) {p.sendPlugMail(lcuuid, data['VM_LCUUID']);errorcallback(dataerror);});
    });
    app.fire('', function(){logger.info('Pluging nas_storage service finished.');});
}

NasStorage.prototype.ticket = function(title, content,userid, callback, errorcallback) {
    var p = this;
    p.callbackWeb('/ticket/submitticket', 'post',{ title: title, content:content,type:0,userid:userid},
        function(scode,resp){
            if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS') {
                p.callbackWeb('/ticket/replyticket', 'post',{ menuid: resp.TICKETID, content: '系统正在为您处理，请您耐心等待'},
                        function(scode,resp){
                    if ('OPT_STATUS' in resp && resp.OPT_STATUS == 'SUCCESS') {
                        logger.info('replyticket ticketid create finished:', arguments);
                    } else {
                        logger.error('replyticket ticketid create failed:', arguments);
                        errorcallback(sCode);
                    }
                },function() {
                    logger.error('replyticket ticketid create failed:', arguments);
                    errorcallback(sCode);
                });
            } else {
                logger.info('submitticket ticketid', resp.TICKETID,'create failed', arguments);
                errorcallback(sCode);
            }
        },function() {
            logger.info('submitticket ticketid', resp.TICKETID,'create failed', arguments);
            errorcallback(sCode);
        });
}

NasStorage.prototype.unplug = function(data, callback, errorcallback) {
    logger.debug('Unpluging nas_storage service');
    var p = this;
    var lcuuid = '';
    var connection_lcuuid = '';
    var userid = '';
    var objectid = '';
    var operator_name = data['operator_name'];

    if ('lcuuid' in data) {
        lcuuid = data.lcuuid;
    }
    if ('connection_lcuuid' in data) {
        connection_lcuuid = data.connection_lcuuid;
    }
    var check_res = p.checkApiUNPlugData(data, errorcallback);
    if (!check_res) {
        logger.info('Create request check failed')
        return;
    }
    delete data['operator_name'];
    p.sendData('/v1/nas-storages/' + lcuuid , 'get', {}, function(sCode, rdata){
        userid = rdata.DATA.USERID;
        objectid = rdata.DATA.ID;
        if('DATA' in rdata){
            p.sendData('/v1/nas-storages/'+ lcuuid+'/connection/'+connection_lcuuid , 'delete', {},function(sCode, rdata){
                if ('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS') {
                    callback(rdata);
                    operationLog.create_and_update({operation:'unplug', objecttype:'nas', objectid:objectid,
                        object_userid:userid, operator_name:operator_name, opt_result:1}, function(){}, function(){});
                }else{
                    p.sendUnplugMail(lcuuid, connection_lcuuid);
                    errorcallback(400, {OPT_STATUS: constr.OPT.SERVER_ERROR_TRY_AGAIN,DESCRIPTION: constr.OPT_EN.SERVER_ERROR_TRY_AGAIN});
                    app.STD_END();
                }
            }, function(a,dataerror) {p.sendUnplugMail(lcuuid, connection_lcuuid);errorcallback(dataerror);});
      }else{
          p.sendUnplugMail(lcuuid, connection_lcuuid);
          errorcallback(sCode);
      }
    }, errorcallback);
}

NasStorage.prototype.notify = function(data, callback, errorcallback) {
    logger.debug('Notifying nas_storage info');
    var p = this;
    var check_res = p.checkApiNotifyData(data, errorcallback);
    if (!check_res) {
        logger.info('Notify request check failed')
        return;
    }
    p.selectSql(
        [p.tableName, 'path', data.path],
        function(ans) {
            if (ans.length > 0){
                p.updateSql(
                    [p.tableName, data, 'id', ans[0].id],
                    function(update_ans){
                        res = {};
                        res.OPT_STATUS = 'SUCCESS';
                        res.DESCRIPTION = '';
                        callback(res);
                        p.sendToMsgCenter(
                            {type:'user',
                             target:ans[0].userid,
                             msg:{action:'notify', state:'done', type:'nas_storage', id:ans[0].id, data:data}});
                    },
                    errorcallback
                );
            } else {
                errorcallback(404);
            }
        },
        errorcallback
    );
}

NasStorage.prototype.del = function(data, callback, errorcallback) {
    logger.info('Deleting nas_storage service');
    var p = this;
    var lcuuid = '';
    if('lcuuid' in data){
        lcuuid = data.lcuuid
    }
    var userid = '';
    var objectid = '';
    var path = '';
    p.sendData('/v1/nas-storages/' + lcuuid , 'get', {}, function(sCode, rdata){
        userid = rdata.DATA.USERID;
        objectid = rdata.DATA.ID;
        path = rdata.DATA.PATH;
        if('DATA' in rdata){
            p.sendData('/v1/nas-storages/' + lcuuid , 'delete', {},function(sCode, del_rdata){
                var condition = 'select useruuid from ?? where ??=?';
                var param = [];
                param.push('id');
                param.push(userid);
                p.executeSql(condition)([NasStorage.prototype.user_tableName].concat(param),function(ans){
                    if (ans != null && ans.length > 0) {
                        var useruuid = ans[0].useruuid;
                        p.callCharge('/charges/?DOMAIN=' + rdata.DATA.DOMAIN +'&TYPE=nas&LCUUID=' + rdata.DATA.LCUUID + '&USERUUID=' + useruuid, 'delete',{},function(resp){
                            logger.debug('del nas charge record success');
                        },function() {
                            logger.debug('del nas charge record failed');
                        });
                    }
                },function(a){errorcallback(a);});
                operationLog.create_and_update({operation:'delete', objecttype:'nas', objectid:objectid,
                    object_userid:userid, operator_name:data['operator_name'], opt_result:1}, function(){}, function(){});
                callback(del_rdata);
            },  function(a,dataerror) {p.sendDeleteMail(path, userid);;errorcallback(dataerror);});
      }else{
          errorcallback(sCode);
      }
    }, errorcallback);
}

NasStorage.prototype.start_charge = function(data, callback, errorcallback){
    var p = this;
    var key,value;
    if('id' in data){
        key = 'id';
        value = data.id;
    }else if('lcuuid' in data){
        key = 'lcuuid';
        value = data.lcuuid;
    }
    p.selectSql([p.tableName, key, value],function(nas_ans) {
        if (nas_ans.length > 0){
            data.lcuuid = nas_ans[0].lcuuid;
            data.product_specification_lcuuid = nas_ans[0].product_specification_lcuuid;
            data.DOMAIN = nas_ans[0].domain;
            data.USERID = nas_ans[0].userid;
            data.TOTAL_SIZE = parseInt(nas_ans[0].total_size);
            p.data = data;
            data.PRODUCT_TYPE = 'nas';

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

NasStorage.prototype.start_charge_handler = function(callback, errorcallback) {
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
        p.sendData('/v1/charges/nas-storages/' + p.data.lcuuid , 'post', filter,function(sCode,data) {
            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS') {
                if(rdata.DATA.RULE_FLAG && rdata.DATA.USER_PRESENT_QUANTIY > 0){
                    var condition_insert = "INSERT INTO ?? (promotion_rules_id,object_type,object_lcuuid,present_days,present_quantity,userid)values(?,?,?,?,?,?);";
                    var param_insert = [NasStorage.prototype.promotion_rules_detail_tableName];
                    param_insert.push(rdata.DATA.PROMOTION_RULES_ID);
                    param_insert.push('nas');
                    param_insert.push(p.data.lcuuid);
                    param_insert.push(rdata.DATA.USER_PRICE_DAYS);
                    param_insert.push(rdata.DATA.USER_PRESENT_QUANTIY);
                    param_insert.push(p.data.USERID);
                    p.executeSql(condition_insert)(param_insert, function(rdata){},errorcallback);
                }
                logger.debug('add nas charge record success');
                callback();
            } else {
                logger.debug('add nas charge record failed');
                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add nas charge record failed'});
            }
        },function() {
            logger.error('add nas charge request failed');
            errorcallback(500, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'add nas charge record failed'});
        });
    }
    var cas = new Cashier();
    cas.get_charge_info(p.data,cashierCallback);
}

module.exports=NasStorage;
