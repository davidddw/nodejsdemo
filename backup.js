var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Instance = require('./instance.js');
var uuid = require('node-uuid');
var operationLog = require('./operation_log.js');
var executor=require('child_process');
var user = require('./user.js');
var constr = require('./const.js');
var Domain = require('./domain.js');
var balance = require('./balance.js');
var Cashier = require('./cashier.js');

var Backup = function(){
    Obj.call(this);
    this.tableCols = [];
};

util.inherits(Backup, Obj);
Backup.prototype.tableName = 'backup_space_v2_2';
Backup.prototype.user_tableName = 'fdb_user_v2_2';
Backup.prototype.promotion_rules_detail_tableName = 'promotion_rules_detail';
Backup.prototype.type = 'backup';
Backup.prototype.constructor = Backup;
Backup.prototype.requiredApiData = {
    TOTAL_SIZE: 'TOTAL_SIZE',
    USERID: 'USERID',
    ORDER_ID: 'ORDER_ID',
    PRODUCT_SPECIFICATION_LCUUID: 'PRODUCT_SPECIFICATION_LCUUID',
    DOMAIN: 'DOMAIN',
    CLIENT_ID:'CLIENT_ID'
};
Backup.prototype.requireUrlParams = {
    'userid':'userid',
    'id':'id',
    'lcuuid':'lcuuid',
    'order_id':'order_id',
    'domain':'domain',
    'ip':'ip',
    'path':'path',
    'client_mac':'client_mac',
    'job_name':'job_name',
    'job_id':'job_id',
    'server_ip':'server_ip',
    'job_cid':'job_cid',
    'partial_sign':'partial_sign'
};
//create backup spaces
Backup.prototype.create_spaces = function(data, callback, errorcallback) {
    logger.info('Creating backup space');
    var p = this;
    var check_res = p.checkApiCreateSpaceData(data, errorcallback);
    if (!check_res) {
        logger.info('Create request check failed');
        return;
    }
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    var backup_lcuuid = '';
    p.sendBackupData('/v1/backup-spaces' , 'post', data, function(sCode, rdata){
        if('DATA' in rdata){
            backup_lcuuid= rdata.DATA.LCUUID;
            operationLog.create_and_update({
                operation:'create',
                objecttype:'backupspace',
                objectid:rdata.DATA.ID,
                comment:'云备份空间'+rdata.DATA.TOTAL_SIZE+'G 创建',
                object_userid:rdata.DATA.USERID,
                operator_name:operator_name,
                opt_result:1
            }, function(){}, function(){});
            var response = {OPT_STATUS: constr.OPT.SUCCESS, data:{}};
            var backup_charge = [{}];
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
                    backup_charge[0].NAME = 'Backup';
                    backup_charge[0].OBJ_LCUUID = rdata.DATA.LCUUID;
                    backup_charge[0].SIZE = rdata.DATA.TOTAL_SIZE;
                    backup_charge[0].PS_LCUUID = rdata.DATA.PRODUCT_SPECIFICATION_LCUUID;
                    response.data.BACKUP = backup_charge;
                    response.data = JSON.stringify(response.data);
                    p.callbackWeb('/order/confirmorder', 'post',response,function(resp){
                        logger.info('order_id', data.ORDER_ID,'create continue since notify web finished:', arguments);
                    },function() {
                        logger.error('order_id', data.ORDER_ID,'create continue but notify web failed:', arguments);
                    });
                }
            },function(){logger.info('backup get session failed.');});
            callback(rdata);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
};

//modify space size
Backup.prototype.modify_spaces  = function(data, callback, errorcallback) {
    logger.info('Modify backup space',data);
    var p = this;
    var response = {opt_status: constr.OPT.SUCCESS, data:{}};
    var backup_lcuuid = '';
    var backup_charge = [{}];
    if ('lcuuid' in data) {
        backup_lcuuid = data.lcuuid;
        lcuuid = '/' + data.lcuuid;
    }
    var operator_name =  data['operator_name'];
    delete data['lcuuid'];
    delete data['operator_name'];

    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var backup_space = {};
    flow_steps.push(function(a, f) {
        p.sendBackupData('/v1/backup-spaces' + lcuuid , 'get', '', function(sCode, rdata){
            if('DATA' in rdata){
                backup_space = rdata.DATA;
                f(a);
            } else {
                errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, ERR_MSG : 'backup space not found'});
                app.STD_END();
            }
        }, function(){errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG: 'get backup space error'}); app.STD_END();});
    });

    flow_steps.push(function(a, f) {
        var condition = 'select useruuid from ?? where ??=?';
        var balance_data = {'BACKUP':[{}]};
        p.executeSql(condition)([Backup.prototype.user_tableName, 'id', backup_space.USERID],function(user){
            if (user != null && user.length > 0){
                balance_data.DOMAIN = backup_space.DOMAIN;
                balance_data.USERUUID = user[0].useruuid;
                balance_data.USERID = backup_space.USERID;
                balance_data.BACKUP[0].TOTAL_SIZE = data.TOTAL_SIZE;
                balance_data.BACKUP[0].PRODUCT_SPECIFICATION_LCUUID = backup_space.PRODUCT_SPECIFICATION_LCUUID;
                balance_data.BACKUP[0].DOMAIN = backup_space.DOMAIN;;
                p.callCharge('/balance-checks', 'post', balance_data, function(resp){
                        f(a);
                    },function() {
                        logger.debug('check backup space balance failed');
                        errorcallback(402, {OPT_STATUS: constr.OPT.NOT_ENOUGH_USER_BALANCE, ERR_MSG : 'check backup space balance failed'});
                        app.STD_END();
                });
            }
        }, function(){errorcallback(404,{OPT_STATUS: constr.OPT.SERVER_ERROR, ERR_MSG : 'change userid to useruuid failed'});app.STD_END()});
    });

    flow_steps.push(function(a, f) {
        p.sendBackupData('/v1/backup-spaces'+ lcuuid , 'patch', data, function(sCode, rdata){
            if('DATA' in rdata){
                var userid = rdata.DATA.USERID;
                response.user_id = userid;
                response.domain = rdata.DATA.DOMAIN;
                response.autoconfirm = 1;
                response.content = JSON.stringify({backup_mdf:[{content:'云备份空间扩容到'+data.TOTAL_SIZE + 'G',lcuuid:backup_lcuuid}]});
                response.data.ORDER_ID = 0;
                response.data.USERID = userid;
                response.data.DOMAIN = rdata.DATA.DOMAIN;
                backup_charge[0].NAME = 'Backup';
                backup_charge[0].OBJ_LCUUID = backup_lcuuid;
                backup_charge[0].SIZE = data.TOTAL_SIZE;
                backup_charge[0].PS_LCUUID = rdata.DATA.PRODUCT_SPECIFICATION_LCUUID;
                backup_charge[0].MDF_FLAG = true;
                response.data.BACKUP = backup_charge;
                logger.info("backup response: ", response);
                p.getSession(userid, function(ans){
                    if (ans != null && ans.length > 0) {
                        response.session = ans[0].session;
                        response.data.USERUUID = ans[0].useruuid;
                        response.useruuid = ans[0].useruuid;
                        response.data = JSON.stringify(response.data);
                        p.callbackWeb('/order/addorder', 'post', response, function(sCode,order_data){
                            if (sCode == 200){
                                logger.info('modify insert into order success');
                            }else{
                                errorcallback(sCode);
                            }
                            operationLog.create_and_update({
                                operation:'update',
                                objecttype:'backupspace',
                                objectid:rdata.DATA.ID,
                                object_userid:userid,
                                comment:'云备份空间扩容到'+data.TOTAL_SIZE + 'G',
                                operator_name:operator_name,
                                opt_result:1
                            }, function(){}, function(){});
                        },function() {
                            logger.error('modify insert into order failed');
                        });
                    }
                },function(){logger.info('backup get session failed.');});
            }
            callback(rdata);
        },errorcallback);
    });
    app.fire('',function() {logger.info('modify backup space finished.');});
}

//delete space
Backup.prototype.delete_spaces = function(data, callback, errorcallback) {
    logger.info('Deleting backup space');
    var p = this;
    var lcuuid = '';
    if('lcuuid' in data){
        lcuuid = '/' + data.lcuuid
    }
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    p.sendBackupData('/v1/backup-spaces' + lcuuid , 'get', '', function(sCode, rdata){
        if('DATA' in rdata){
            p.sendBackupData('/v1/backup-spaces'+ lcuuid , 'delete', '', function(del_sCode, del_rdata){
                var condition = 'select useruuid from ?? where ??=?';
                var param = [];
                param.push('id');
                param.push(rdata.DATA.USERID);
                p.executeSql(condition)([Backup.prototype.user_tableName].concat(param),function(ans){
                    if (ans != null && ans.length > 0) {
                        p.callCharge('/charges/?DOMAIN=' + rdata.DATA.DOMAIN +'&TYPE=backup&LCUUID=' + rdata.DATA.LCUUID +
                                     '&USERUUID=' + ans[0].useruuid + '&flag=true', 'delete',{},function(resp){
                            logger.debug('del backup space record success');
                            callback(del_rdata);
                        },function() {
                            logger.debug('del backup space record failed');
                            errorcallback(500,{OPT_STATUS: constr.OPT.SERVER_ERROR,
                                               DESCRIPTION: 'del backup space record failed.'});
                        });
                    } else {
                        errorcallback(404, {OPT_STATUS: constr.OPT.SERVER_ERROR,
                                            DESCRIPTION: 'user not found.'});
                    }
                },function(){errorcallback(500,{OPT_STATUS: constr.OPT.SERVER_ERROR,
                                                DESCRIPTION: 'db error.'})});
            },function(sCode, rdata){
                if ('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'BACKUP_JOB_RUNNING'){
                    errorcallback(500, {OPT_STATUS: constr.OPT.BACKUP_JOB_RUNNING,
                                        DESCRIPTION: 'delete backup space error, still job running.'});
                } else {
                    errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR,
                                        DESCRIPTION: 'delete backup space error.'});
                }
            });
            operationLog.create_and_update({
                operation:'delete',
                objecttype:'backupspace',
                objectid:rdata.DATA.ID,
                object_userid:rdata.DATA.USERID,
                comment:'云备份空间删除',
                operator_name:operator_name,
                opt_result:1
            }, function(){}, function(){});

        } else {
            errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR,
                                DESCRIPTION: 'get backup space null.'});
        }
    }, function(){errorcallback(500, {OPT_STATUS: constr.OPT.SERVER_ERROR,
                                      DESCRIPTION: 'get backup space error.'})});
}

//get space info
Backup.prototype.get_spaces =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};
    var lcuuid = '';

    if ('userid' in data) {
            filter.userid = data.userid;
    }
    if ('order_id' in data) {
        filter.order_id = data.order_id;
    }
    if ('domain' in data) {
        filter.domain = data.domain;
    }

    if ('lcuuid' in data) {
        lcuuid = '/' + data.lcuuid;
    }
    p.sendBackupData('/v1/backup-spaces' + lcuuid , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}
//get space used info
Backup.prototype.get_spaces_used =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
            filter.userid = data.userid;
    }
    p.sendBackupData('/v1/used-backup-spaces', 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}
//create jobs
Backup.prototype.create_jobs = function(data, callback, errorcallback) {
    logger.info('Creating backup jobs');
    var p = this;
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    p.sendBackupData('/v1/jobs' , 'post', data, function(sCode, rdata){
        if('DATA' in rdata){
            callback(rdata);
        }else{
            errorcallback(sCode);
        }
    }, errorcallback);
}
//modify jobs
Backup.prototype.modify_jobs = function(data, callback, errorcallback){
    var p = this;
    var operator_name = data.operator_name;
    delete(data.operator_name);
    var job_id = data.job_id;
    delete(data.job_id);
    p.sendBackupData('/v1/jobs/' + job_id, 'put', data, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}
//delete jobs
Backup.prototype.delete_jobs = function(data, callback, errorcallback) {
    logger.info('Deleting backup job');
    var p = this;
    p.sendBackupData('/v1/jobs' , 'delete', data, function(sCode, rdata){
        if('DATA' in rdata){
            callback(rdata);
        }else{
            errorcallback(sCode);
        }
    },errorcallback);
}
//delete job datas
Backup.prototype.delete_job_datas = function(data, callback, errorcallback) {
    logger.info('Deleting backup job data');
    var p = this;
    p.sendBackupData('/v1/job-datas' , 'delete', data, function(sCode, rdata){
        callback(rdata);
    },errorcallback);
}
//get jobs
Backup.prototype.get_jobs = function(data, callback, errorcallback){
    var p = this;
    var filter = {};
    var id = '';

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('page_index' in data) {
        filter.page_index = data.page_index;
    }
    if ('page_size' in data) {
        filter.page_size = data.page_size;
    }
    if ('id' in data) {
        id = '/' + data.id;
    }

    p.sendBackupData('/v1/jobs' + id , 'get', filter, function(sCode, rdata){
        callback(rdata)
    }, errorcallback);
}

//create backup restores
Backup.prototype.create_restores = function(data, callback, errorcallback) {
    logger.info('Creating backup jobs');
    var p = this;
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    p.sendBackupData('/v1/restores' , 'post', data, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

//user authorization
Backup.prototype.user_authorization  = function(data, callback, errorcallback) {
    logger.info('For backup user authorization',data);
    var p = this;
    var userid = '';

    if ('userid' in data) {
        userid = '/' + data.userid;
    }
    delete data['userid'];
    p.sendBackupData('/v1/users'+ userid , 'patch', data, function(sCode, rdata){
        callback(rdata);
    },errorcallback);
}

Backup.prototype.get_client_data_sources =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('ip' in data) {
        filter.ip = data.ip;
    }
    if ('path' in data) {
        filter.path = data.path;
    }

    p.sendBackupData('/v1/client-data-sources' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.get_clients =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('page_index' in data) {
        filter.page_index = data.page_index;
    }
    if ('page_size' in data) {
        filter.page_size = data.page_size;
    }

    p.sendBackupData('/v1/clients' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.get_has_mysql_on_client =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('client_mac' in data) {
        filter.client_mac = data.client_mac;
    }

    p.sendBackupData('/v1/has-mysql-on-client' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.get_mysql_client_paths =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('client_mac' in data) {
        filter.client_mac = data.client_mac;
    }
    if ('path' in data) {
        filter.path = data.path;
    }

    p.sendBackupData('/v1/mysql-client-paths' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.add_auth_mysql = function(data, callback, errorcallback) {
    logger.info('add auth mysql');
    var p = this;
    var operator_name = data['operator_name'];
    delete data['operator_name'];
    p.sendBackupData('/v1/add-auth-mysql' , 'post', data, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.check_auth_mysql =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('client_mac' in data) {
        filter.client_mac = data.client_mac;
    }
    if ('disp_path' in data) {
        filter.disp_path = data.disp_path;
    }
    if ('port' in data) {
        filter.port = data.port;
    }
    if ('user_name' in data) {
        filter.user_name = data.user_name;
    }
    if ('password' in data) {
        filter.password = data.password;
    }
    p.sendBackupData('/v1/check-auth-mysql' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}
Backup.prototype.get_job_backup_histories =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('job_name' in data) {
        filter.job_name = data.job_name;
    }
    if ('page_index' in data) {
        filter.page_index = data.page_index;
    }
    if ('page_size' in data) {
        filter.page_size = data.page_size;
    }
    p.sendBackupData('/v1/job-backup-histories' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.get_job_restore_histories =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('page_index' in data) {
        filter.page_index = data.page_index;
    }
    if ('page_size' in data) {
        filter.page_size = data.page_size;
    }
    p.sendBackupData('/v1/job-restore-histories' , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.get_restore_timepoints =  function(data, callback, errorcallback){
    var p = this;
    var filter = {};
    var timepoint = '';

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('server_ip' in data) {
        filter.server_ip = data.server_ip;
    }
    if ('job_cid' in data) {
        filter.job_cid = data.job_cid;
    }
    if ('partial_sign' in data) {
        filter.partial_sign = data.partial_sign;
    }
    if ('timepoint' in data) {
        timepoint = '/' + data.timepoint;
    }
    if ('path' in data) {
        filter.path = data.path;
    }
    p.sendBackupData('/v1/restore-timepoints' + timepoint , 'get', filter, function(sCode, rdata){
        callback(rdata);
    }, errorcallback);
}

Backup.prototype.checkApiCreateSpaceData = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.TOTAL_SIZE in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'total_size is not specified'});
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

Backup.prototype.checkUserId = function(data, errorcallback) {
    var required = this.requiredApiData;
    if (!(required.USERID in data)) {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'userid is not specified'});
        return false;
    }
    return true;
}
module.exports=Backup;
