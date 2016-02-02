var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var uuid = require('node-uuid');
var Vm = require('./vm.js');
var operationLog = require('./operation_log.js');
var executor=require('child_process');
var constr = require('./const.js');
var user = require('./user.js');
var Domain = require('./domain.js')

var CloudDisk = function() {
    Obj.call(this);
}

util.inherits(CloudDisk, Obj);

CloudDisk.prototype.tableName = 'cloud_disk_v2_2';
CloudDisk.prototype.mail_plug_subject = '云硬盘挂载操作';
CloudDisk.prototype.mail_unplug_subject = '云硬盘卸载操作';
CloudDisk.prototype.mail_modify_subject = '云硬盘扩容操作';
CloudDisk.prototype.mail_delete_subject = '云硬盘删除操作';
CloudDisk.prototype.fdb_user_tbl = 'fdb_user_v2_2';
CloudDisk.prototype.admin_index = 1;
CloudDisk.prototype.mail_from = 'stats@yunshan.net.cn';
CloudDisk.prototype.vm_tbl = 'vm_v2_2';
CloudDisk.prototype.vm_service_ifindex = 5;
CloudDisk.prototype.vm_devicetype_index = 1;
CloudDisk.prototype.vinterface_tbl = 'vinterface_v2_2';

CloudDisk.prototype.requiredApiData = {
    NAME : 'NAME',
    SIZE : 'SIZE',
    VENDOR : 'VENDOR',
    PRODUCT_SPECIFICATION_LCUUID : 'PRODUCT_SPECIFICATION_LCUUID',
    SERVICE_VENDOR_LCUUID : 'SERVICE_VENDOR_LCUUID',
    ORDER_ID : 'ORDER_ID',
    USERID : 'USERID',
    DOMAIN : 'DOMAIN'
};

CloudDisk.prototype.createMailModifyContent = function(disk_lcuuid, total_size, callback) {
    logger.debug('creating mail cloud disk modify content ');
    var p = this;
    var content = '';
     p.selectSql(
         [p.tableName, 'lcuuid', disk_lcuuid],
         function(disk_rdata){
             if (disk_rdata.length){
                 p.selectSql(
                    [p.fdb_user_tbl, 'id', disk_rdata[0].userid],
                    function(user_rdata){
                        if (user_rdata.length) {
                            content += '用户名称：' + user_rdata[0].username + '； \n';
                            content += '云硬盘名称：' + disk_rdata[0].name + '； \n';
                            content += '扩容后总大小：' + total_size + 'G;';
                            callback(content);
                        } else {
                            logger.error('user %s not exist in db', disk_rdata[0].userid);
                            callback('');
                        }
                    }, function(){});
             } else {
                logger.error('cloud disk %s not exist in db', disk_lcuuid);
                callback('');
             }
     }, function(){});
}

CloudDisk.prototype.sendModifyMail = function(disk_lcuuid, total_size) {
    logger.debug('creating mail cloud disk modify content ');
    var p = this;
    p.selectSql(
        [p.fdb_user_tbl, 'id', p.admin_index],
        function(rdata){
            if(rdata.length){
                p.createMailModifyContent(disk_lcuuid, total_size, function(ans){
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

CloudDisk.prototype.sendDeleteMail = function(name, userid) {
    logger.debug('creating mail cloud disk delete content ');
    var p = this;
    p.selectSql(
        [p.fdb_user_tbl, 'id', p.admin_index],
        function(rdata){
            if(rdata.length){
                p.createMailDeleteContent(name, userid, function(ans){
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

 CloudDisk.prototype.createMailDeleteContent = function(name, userid, callback) {
     logger.debug('creating mail cloud disk delete content ');
     var p = this;
     var content = '';
     p.selectSql(
        [p.fdb_user_tbl, 'id', userid],
        function(user_rdata){
            if (user_rdata.length) {
                content += '用户名称：' + user_rdata[0].username + '； \n';
                content += '云硬盘名称：' + name + '； \n';
                callback(content);
            } else {
                logger.error('user %s not exist in db', userid);
                callback('');
            }
        }, function(){});
}

CloudDisk.prototype.createMailPlugContent = function(disk_lcuuid, vm_lcuuid, callback) {
    logger.debug('creating mail cloud disk plug content ');
    var p = this;
    var content = '';

     p.selectSql(
         [p.tableName, 'lcuuid', disk_lcuuid],
         function(disk_rdata){
           if (disk_rdata.length){
             p.selectSql(
               [p.fdb_user_tbl, 'id', disk_rdata[0].userid],
               function(user_rdata){
                 if (user_rdata.length) {
                   content += '用户名称：' + user_rdata[0].username + '； \n';
                   content += '云硬盘名称：' + disk_rdata[0].name + '； \n';
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
                   logger.error('user %s not exist in db', disk_rdata[0].userid);
                   callback('');
                 }
             }, function(){});
           } else {
             logger.error('cloud disk %s not exist in db', disk_lcuuid);
             callback('');
           }
         }, function(){});

}

CloudDisk.prototype.sendPlugMail = function(disk_lcuuid, vm_lcuuid) {
    logger.debug('creating mail cloud disk plug content ');
    var p = this;
     p.selectSql(
         [p.fdb_user_tbl, 'id', p.admin_index],
         function(rdata){
             if(rdata.length){
                 p.createMailPlugContent(disk_lcuuid, vm_lcuuid, function(ans){
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

CloudDisk.prototype.sendUnplugMail = function(disk_lcuuid) {
    logger.debug('creating mail cloud disk unplug content ');
    var p = this;
     p.selectSql(
         [p.fdb_user_tbl, 'id', p.admin_index],
         function(rdata){
             if(rdata.length){
                 p.createMailUnplugContent(disk_lcuuid, function(ans){
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

CloudDisk.prototype.createMailUnplugContent = function(disk_lcuuid, callback) {
    logger.debug('creating mail cloud disk unplug content ');
    var p = this;
    var content = '';

     p.selectSql(
         [p.tableName, 'lcuuid', disk_lcuuid],
         function(disk_rdata){
           if (disk_rdata.length){
             p.selectSql(
               [p.fdb_user_tbl, 'id', disk_rdata[0].userid],
               function(user_rdata){
                 if (user_rdata.length) {
                   content += '用户名称：' + user_rdata[0].username + '； \n';
                   content += '云硬盘名称：' + disk_rdata[0].name + '； \n';
                         p.selectSql(
                           [p.vm_tbl, 'lcuuid', disk_rdata[0].vm_lcuuid],
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
                   logger.error('user %s not exist in db', disk_rdata[0].userid);
                   callback('');
                 }
             }, function(){});
           } else {
             logger.error('cloud disk %s not exist in db', disk_lcuuid);
             callback('');
           }
         }, function(){});
}

CloudDisk.prototype.checkApiCreateData = function(data, errorcallback) {
	var required = this.requiredApiData;
    if (!(required.NAME in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.RESOURCE_ALREADY_EXIST,DESCRIPTION: 'Resource already exist'});
        return false;
    }
    if (!(required.PRODUCT_SPECIFICATION_LCUUID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'product_specification_lcuuid is not specified'});
        return false;
    }
    if (!(required.ORDER_ID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'order_id is not specified'});
        return false;
    }
    if (!(required.USERID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'userid is not specified'});
        return false;
    }
    if (!(required.VENDOR in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'vendor is not specified'});
        return false;
    }
    if (!(required.SIZE in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'size is not specified'});
        return false;
    }
    if (!(required.DOMAIN in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'domain is not specified'});
        return false;
    }
    if (!(required.SERVICE_VENDOR_LCUUID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'service vendor lcuuid is not specified'});
        return false;
    }
    return true;
}

CloudDisk.prototype.get = function(data, callback, errorcallback) {
    var p = this;
    var filter = {};
    var lcuuid = '';
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var response = {OPT_STATUS: constr.OPT.SUCCESS, DATA:[]};
     if ('lcuuid' in data) {
         lcuuid = '/'+ data.lcuuid;
     }
     if ('userid' in data) {
         filter.userid = data.userid;
     }
     if ('domain' in data) {
         filter.domain = data.domain;
     }
     if ('state' in data) {
         filter.state = data.state;
     }
     if ('order-id' in data) {
         filter["order-id"] = data["order-id"];
     }
    flow_steps.push(function(a, f){
        p.sendData('/v1/cloud-disks' + lcuuid , 'get', filter, function(sCode, rdata){
        response = rdata;
        f(response.DATA);
        }, errorcallback);
    });
    user.fill_user_for_bdb_instance(p, app, errorcallback);

    var domain = new Domain();
    domain.fill_domain_for_bdb_instance(p, app, errorcallback);

    app.fire('', function(){callback(response);});
}

CloudDisk.prototype.create = function(data, callback, errorcallback) {
    var p = this;
    var check_res = p.checkApiCreateData(data, errorcallback);
    if (!check_res) {
        logger.info('Create request check failed')
        return;
    }
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    var lcuuid = '';

    p.sendData('/v1/cloud-disks', 'post', data,function(sCode, rdata) {
        if('DATA' in rdata){
            lcuuid= rdata.DATA.LCUUID;
            operationLog.create_and_update({operation:'create', objecttype:'cloud_disk', objectid:rdata.DATA.ID,
                object_userid:data.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});
            p.sendData('/v1/charges/cloud-disks/' + lcuuid, 'post', {},function(sCode, rdata) {callback(rdata);}, errorcallback);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
}

CloudDisk.prototype.modify = function(data, callback, errorcallback) {
    var p = this;
    var filter = {};
    var required = this.requiredApiData;
    var cloud_disk_lcuuid = '';
    if (required.SIZE in data) {
        filter.SIZE = data.SIZE;
    }
    if ('cloud_disk_lcuuid' in data) {
        cloud_disk_lcuuid = data.cloud_disk_lcuuid
    }
    var operator_name = data['operator_name'];
    p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid, 'patch', filter,
            function(sCode, rdata) {
        if (rdata.OPT_STATUS == 'SUCCESS') {
            operationLog.create_and_update({operation:'update', objecttype:'cloud_disk', objectid:rdata.DATA.ID,
                object_userid:data.USERID, operator_name:operator_name, opt_result:1}, function(){}, function(){});
            p.sendData('/v1/charges/cloud-disks/' + cloud_disk_lcuuid, 'delete', {}, function(sCode, rdata) {}, rdata);
            p.sendData('/v1/charges/cloud-disks/' + cloud_disk_lcuuid, 'post', {},function(sCode, rdata) {callback(rdata);}, errorcallback);
            p.sendModifyMail(cloud_disk_lcuuid, data.SIZE);
            callback(rdata);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
}

CloudDisk.prototype.del = function(data, callback, errorcallback) {
    var p = this;
    var cloud_disk_lcuuid = '';
    if ('cloud_disk_lcuuid' in data) {
        cloud_disk_lcuuid = data.cloud_disk_lcuuid
    }
    var userid = '';
    var objectid = '';
    p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid , 'get', {}, function(sCode, rdata){
        userid = rdata.DATA.USERID;
        objectid = rdata.DATA.ID;
        name = rdata.DATA.NAME;
        if('DATA' in rdata){
            p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid, 'delete', {},function(sCode, rdata) {
                p.sendData('/v1/charges/cloud-disks/' + cloud_disk_lcuuid, 'delete', {}, function(sCode, rdata) {
                    if (rdata.OPT_STATUS == 'SUCCESS') {
                        operationLog.create_and_update({operation:'delete', objecttype:'cloud_disk', objectid:objectid,
                            object_userid:userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                        p.sendDeleteMail(name, userid);
                        callback(rdata);
                    }else{
                        errorcallback(sCode);
                    }
                }, rdata);
            }, errorcallback);
      }else{
          errorcallback(sCode);
      }
    }, errorcallback);
}

CloudDisk.prototype.plug = function(data, callback, errorcallback) {
    logger.debug('Pluging cloud disk service');
    var p = this;
    var filter = {};
    var cloud_disk_lcuuid = '';
    if ('cloud_disk_lcuuid' in data) {
        cloud_disk_lcuuid = data.cloud_disk_lcuuid
    }
    if ('VM_LCUUID' in data) {
        filter.VM_LCUUID = data.VM_LCUUID;
    }

    var userid = '';
    var objectid = '';
    p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid , 'get', {}, function(sCode, rdata){
        userid = rdata.DATA.USERID;
        objectid = rdata.DATA.ID;
        if('DATA' in rdata){
            p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid + '/connection', 'post', filter,
                    function(sCode, rdata) {
                if (rdata.OPT_STATUS == 'SUCCESS') {
                    operationLog.create_and_update({operation:'plug', objecttype:'cloud_disk', objectid:objectid,
                        object_userid:userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                    p.sendPlugMail(cloud_disk_lcuuid, filter.VM_LCUUID);
                    callback(rdata);
                }else{
                    errorcallback(sCode);
                }
            }, errorcallback);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
}

CloudDisk.prototype.unplug = function(data, callback, errorcallback) {
    logger.debug('Unpluging cloud disk service');
    var p = this;
    var cloud_disk_lcuuid = '';
    var vm_lcuuid = '';
    if ('cloud_disk_lcuuid' in data) {
        cloud_disk_lcuuid = data.cloud_disk_lcuuid
    }
    if ('vm_lcuuid' in data) {
        filter.vm_lcuuid = data.vm_lcuuid;
    }
    var userid = '';
    var objectid = '';
    p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid , 'get', {}, function(sCode, rdata){
        userid = rdata.DATA.USERID;
        objectid = rdata.DATA.ID;
        if('DATA' in rdata){
            p.sendData('/v1/cloud-disks/' + cloud_disk_lcuuid + '/connection','delete', {},function(sCode, rdata) {
                if (rdata.OPT_STATUS == 'SUCCESS') {
                    operationLog.create_and_update({operation:'unplug', objecttype:'cloud_disk', objectid:objectid,
                        object_userid:userid, operator_name:data.operator_name, opt_result:1}, function(){}, function(){});
                    p.sendUnplugMail(cloud_disk_lcuuid, userid);
                }else{
                    errorcallback(sCode);
                }
            }, errorcallback);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
}

CloudDisk.prototype.startCharge = function(data, callback, errorcallback) {
    logger.debug('Starting start charge service');
    var p = this;
    var lcuuid = '';
    if ('LCUUID' in data) {
        lcuuid = data.LCUUID
    }
    p.sendData('/v1/charges/cloud-disks/' + lcuuid, 'post', {},
        function(sCode, rdata) {callback(rdata);
    }, errorcallback);
}

CloudDisk.prototype.stopCharge = function(data, callback, errorcallback) {
    logger.debug('Ending end charge service');
    var p = this;
    var lcuuid = '';
    if ('LCUUID' in data) {
        lcuuid = data.LCUUID
    }
    p.sendData('/v1/charges/cloud-disks/' + lcuuid, 'delete', {}, function(sCode, rdata) {
        callback(rdata);
    }, errorcallback);
}

module.exports = CloudDisk;
