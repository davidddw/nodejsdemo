var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var lc_utils = require('./lc_utils.js');
var constr = require('./const.js');
var atry = require('./mydomain.js');
var Domain = require('./domain.js');
var data = require('./data.js');
var uuid = require('node-uuid');
var product = require('./product.js');
var api = require('./api.js');
var db = require('./db.js');
var instancePot = require('./instancePot.js');
var validator = require('validator');
var constr = require('./const.js');


var Vm_Snapshot = function(){
    Obj.call(this);
}
util.inherits(Vm_Snapshot, Obj);

Vm_Snapshot.prototype.key = 'VM_SNAPSHOT';
Vm_Snapshot.prototype.onActionDone = function(action, syncResult){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        var userid = Q.getData('userInfo').id;
        var result = syncResult ? syncResult : placeHolder;
        instancePot._event.once(Vm_Snapshot.prototype.key + result.DATA.LCUUID + action,
            function(asyncResData){
                if (asyncResData.OPT_STATUS != constr.OPT.SUCCESS ||
                    ('ERRNO' in asyncResData.DATA && asyncResData.DATA.ERRNO != 0)){
                    Obj.prototype.sendToMsgCenter({
                        type:'user', target: userid,
                        msg:{action: action, state: 'fail',
                            type: Vm_Snapshot.prototype.key, lcuuid:asyncResData.DATA.LCUUID,
                            data:asyncResData.DATA.SNAPSHOTS[0]}
                    })
                    instancePot.remove(result.DATA.LCUUID, action);
                    Q.setData('asyncState', constr.OPT.FAIL);
                    onFullfilled(constr.OPT.FAIL);
                } else {
                    Obj.prototype.sendToMsgCenter({
                        type:'user', target: userid,
                        msg:{action: action, state: 'success',
                            type: Vm_Snapshot.prototype.key, lcuuid:asyncResData.DATA.LCUUID,
                            data:asyncResData.DATA.SNAPSHOTS[0]}
                    })
                    instancePot.remove(result.DATA.LCUUID, action);
                    Q.setData('asyncState', constr.OPT.SUCCESS);
                    onFullfilled(constr.OPT.SUCCESS);
                }
            }
        )
    })
}

Vm_Snapshot.prototype.snapshot = function(options, syncCallback){
    options = lc_utils.upperJsonKey(options);
    var lcuuid = options.LCUUID
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    Q.setData('startTime', new Date().toMysqlFormat());
    //placeHolder is null here
    Q.then(function(placeHolder, onFullfilled){
        onFullfilled({
            'data': options,
            'validator': data.storageSnapshot(),
        });
    })
    .then(data.checkParamsValid('', function (data){
        delete(data['LCUUID']);
        Q.setData('queryParam', data);
        return data;
    }))
    //get vm info
    .then(db.fetch('fdb_vm'+constr.SQL_VERSION, {lcuuid: options.LCUUID}, function(data){
        Q.setData('vmInfo', data[0]);
        return {'id': data[0].userid};
    }))
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
        Q.setData('userInfo', data[0]);
    }))
    //build balance-check data
    .then(function(data, onFullfilled){
        var userInfo = Q.getData('userInfo');
        var vmInfo = Q.getData('vmInfo');
        onFullfilled({
            'DOMAIN': vmInfo.domain,
            'USERUUID': userInfo.useruuid,
            'VMSNAPSHOT': {
                'DOMAIN': vmInfo.domain,
                'SIZE': vmInfo.sys_disk_size + vmInfo.user_disk_size,
                'PRODUCT_SPECIFICATION_LCUUID': Q.getData('queryParam').PRODUCT_SPECIFICATION_LCUUID,
            }
        })
    })
    //check balance
    .then(api.callCharge('POST', '/balance-checks', '', function(){
        return Q.getData('queryParam');
    }))

    .then(function(data, onFullfilled){
        onFullfilled(Q.getData('queryParam'))
    })
    //the snapshot url is set synchronously;
    .then(api.callVMSnapshot('POST', 'v1/vms/'+lcuuid+'/snapshots', ''))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        Q.setRejectHandler(logger.info);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            var userid = Q.getData('userInfo').id;
            Q.setData('userid', userid)
            //send to msg center
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: userid,
                msg: {
                    action: 'create', state: 'start',
                    type: Vm_Snapshot.prototype.key, lcuuid: result.DATA.LCUUID,
                    data: result.DATA.SNAPSHOTS[0],
                }
            });
            Q.setData('snapshot_lcuuid', result.DATA.SNAPSHOTS[0].LCUUID);
            Q.setData('snapshot_name', result.DATA.SNAPSHOTS[0].NAME);
            instancePot.store(result.DATA.LCUUID, 'create', {'STATE': 'snapshotting'});
            Q.then(Vm_Snapshot.prototype.onActionDone('create', result));
        } else {
            Q.reject('create failed');
        }
        onFullfilled();
    })
    return Q;
}

Vm_Snapshot.prototype.del = function(vmLcuuid, snapshotLcuuid, syncCallback){
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    return Q.then(function(placeHolder, onFullfilled){
        if (validator.isUUID(vmLcuuid) && validator.isUUID(snapshotLcuuid)){
        } else {
            Q.reject({'OPT_STATUS': constr.OPT.FAIL, 'MSG': 'lcuuid illegal'})
        }
        onFullfilled();
    })
    .then(function(result, onFullfilled){
        if (instancePot.get(vmLcuuid, '')){
            Q.reject({'OPT_STATUS': constr.OPT.RESOURCE_STATE_ERROR,
                'DATA': instancePot[vmLcuuid]})
        }
        onFullfilled()
    })
    //get vm info
    .then(db.fetch('fdb_vm'+constr.SQL_VERSION, {lcuuid: vmLcuuid}, function(data){
        Q.setData('vmInfo', data[0]);
        return {'id': data[0].userid};
    }))
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
        Q.setData('userInfo', data[0]);
        return '';
    }))
    //the snapshot url is set synchronously;
    .then(api.callVMSnapshot('DEL', 'v1/vms/'+vmLcuuid+'/snapshots/'+snapshotLcuuid, ''))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        Q.setRejectHandler(logger.info);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            var userid = Q.getData('userInfo').id;
            var domain = result.DATA.SNAPSHOTS[0].DOMAIN;
            var snapshot_lcuuid = result.DATA.SNAPSHOTS[0].LCUUID;
            Q.setData('userid', userid);
            Q.setData('domain', domain);
            Q.setData('snapshot_lcuuid', snapshot_lcuuid);
            Obj.prototype.sendToMsgCenter({
                type: 'user', target:userid,
                msg: {
                    action: 'deletesnapshot', state: 'start',
                    type: Vm_Snapshot.prototype.key, lcuuid: result.DATA.LCUUID,
                    data: result.DATA,
                }
            });
            instancePot.store(result.DATA.LCUUID, 'deletesnapshot',
                {'STATE': 'deletesnapshotting'});
            Q.then(Vm_Snapshot.prototype.onActionDone('deletesnapshot', result));
        } else {
            Q.reject();
        }
        onFullfilled();
    })
}
//get use async callback for res_return
Vm_Snapshot.prototype.get = function(filter, dataParse){
    var Q = new flow.Qpack(flow.serial);
    dataParse = dataParse ? dataParse : function(){return arguments};
    var snapshot_lcuuid='';
    if('snapshot_lcuuid' in filter){
        snapshot_lcuuid = '/'+filter.snapshot_lcuuid;
    }
    return Q.then(function(placeHolder, onFullfilled){
        filter = filter ? filter : placeHolder;
        onFullfilled({
            'data': filter,
            'validator': data.vmSnapshotGet(),
        })
    })
    .then(data.checkParamsValid())
    .then(api.callVMSnapshot('GET', 'v1/snapshots'+snapshot_lcuuid, ''))
    .then(function(data, onFullfilled){
        if (data.code == 200){
            data = data.body;
            if (data.OPT_STATUS == constr.OPT.SUCCESS){
                for (var i=0; i<data.DATA.length; i++){
                    var potData = instancePot.get(data.DATA[i].LCUUID);
                    if (potData){
                        for (var action in potData){
                            lc_utils.updateObject(data.DATA[i], potData[action]);
                        }
                    }
                }
                onFullfilled(dataParse({'OPT_STATUS': 'SUCCESS', 'DATA': data.DATA}));
            } else {
                onFullfilled(dataParse(data.code));
            }
        } else {
            onFullfilled(dataParse(data.code));
        }
    })
}

Vm_Snapshot.prototype.reverseSnapshot = function(vmLcuuid, snapshotLcuuid, syncCallback){
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    return Q.then(function(placeHolder, onFullfilled){
        lcuuid = vmLcuuid ? vmLcuuid : placeHolder;
        if (validator.isUUID(vmLcuuid) && validator.isUUID(snapshotLcuuid)){
        } else {
            Q.reject({'OPT_STATUS': constr.OPT.FAIL, 'MSG': 'lcuuid illegal'})
        }
        onFullfilled();
    })
    .then(function(result, onFullfilled){
        if (instancePot.get(vmLcuuid, '')){
            Q.reject({'OPT_STATUS': constr.OPT.RESOURCE_STATE_ERROR,
                'DATA': instancePot[vmLcuuid]})
        }
        onFullfilled()
    })
    //get vm info
    .then(db.fetch('fdb_vm'+constr.SQL_VERSION, {lcuuid: vmLcuuid}, function(data){
        Q.setData('vmInfo', data[0]);
        return {'id': data[0].userid};
    }))
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
        Q.setData('userInfo', data[0]);
        return '';
    }))
    //the snapshot url is set synchronously;
    .then(api.callVMSnapshot('POST',
        'v1/vms/'+vmLcuuid+'/snapshots/'+snapshotLcuuid+'/reversion'))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        Q.setRejectHandler(logger.info);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            var userid = Q.getData('userInfo').id;
            Q.setData('userid', userid);
            Obj.prototype.sendToMsgCenter({
                type: 'user', target:result.DATA.USERUUID,
                msg: {
                    action: 'reversesnapshot', state: 'start',
                    type: Vm_Snapshot.prototype.key, lcuuid: result.DATA.LCUUID,
                    data: result.DATA,
                }
            });
            instancePot.store(result.DATA.LCUUID, 'reversesnapshot',
                {'STATE': 'reversesnapshotting'});
            Q.then(Vm_Snapshot.prototype.onActionDone('reversesnapshot', result));
        } else {
            Q.reject();
        }
        onFullfilled();
    })
}

var checkVagent = function(vmLcuuid, syncCallback, errorCallback, count){
    count = count ? count : 0;
    var maxCount = 20;
    api.api.get('v1/vms/'+vmLcuuid+'/vagent/', '',
        function(sCode, body){
            if (body.OPT_STATUS !== constr.OPT.SUCCESS && count < maxCount){
                setTimeout(function(){
                        checkVagent(vmLcuuid, syncCallback, errorCallback, count);
                    }, 10000)
                count++;
            } else {
                syncCallback(body);
            }
        },
        function(sCode, body){
            if (count < maxCount){
                setTimeout(function(){
                        checkVagent(vmLcuuid, syncCallback, errorCallback, count);
                    }, 10000)
                count++;
            } else {
                logger.info('check vagent max count exceeded');
                syncCallback(body);
            }
        }
    )
}

Vm_Snapshot.prototype.checkVagent = checkVagent;

Vm_Snapshot.prototype.resetVmNetwork = function(vmLcuuid, syncCallback){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        Q.setRejectHandler(syncCallback);
        vmLcuuid = vmLcuuid ? vmLcuuid : placeHolder;
        if (!validator.isUUID(vmLcuuid)){
            Q.reject({OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL})
        }
        onFullfilled();
    })
    //check Vagent status
    .then(function(data, onFullfilled){
        checkVagent(vmLcuuid,
            function(){
                onFullfilled()
            },
            function(data){
                Q.reject(data);
                onFullfilled();
            }
        )
    })
    .then(api.callVMSnapshot('GET', 'v1/vms/'+vmLcuuid))
    .then(function(vmData, onFullfilled){
        vmData = vmData.body.DATA;
        logger.info(vmData);
        var vifs_data = {
            GATEWAY: vmData.GATEWAY,
            LOOPBACK_IPS: vmData.LOOPBACK_IPS,
            INTERFACES: [],
        };
        for (var i = 0; i < vmData.INTERFACES.length; i++) {
            if (vmData.INTERFACES[i].IF_TYPE == 'CONTROL') {
                continue;
            } else {
                vifs_data.INTERFACES[i] = {};
            }
            if (vmData.INTERFACES[i].IF_TYPE == 'SERVICE') {
                vifs_data.INTERFACES[i].IF_TYPE = vmData.INTERFACES[i].IF_TYPE;
                vifs_data.INTERFACES[i].STATE = vmData.INTERFACES[i].STATE;
                vifs_data.INTERFACES[i].IF_INDEX = vmData.INTERFACES[i].IF_INDEX;
            } else {
                vifs_data.INTERFACES[i] = vmData.INTERFACES[i];
            }
        }
        onFullfilled(vifs_data);
    })
    .then(api.callVMSnapshot('PATCH', 'v1/vms/'+ vmLcuuid));
}


/**************vm snapshot operation log***************/
Vm_Snapshot.prototype.addLog = function(data, comment){
    var Q = new flow.Qpack(flow.serial);
    data = lc_utils.upperJsonKey(data);
    return Q.then(function(state, onFullfilled){
        onFullfilled();
    })
    .then(function(data, onFullfilled){
        var state = (Q.getData('asyncState') == constr.OPT.SUCCESS) ? 1 : 2;
        var vmInfo = Q.getData('vmInfo');
        var text = util.format(comment, vmInfo.name);
        Obj.prototype.sendToMsgCenter({
            type: 'user', target: vmInfo.userid,
            msg:{
                type: 'output',
                state: state,
                text: text,
            }
        })
        onFullfilled({
            objecttype: 'vm',
            objectid: vmInfo.id,
            object_userid: vmInfo.userid,
            opt_result: state,
            start_time: Q.getData('startTime'),
            end_time: new Date().toMysqlFormat(),
            operator_name: Q.getData('operatorName'),
            name: vmInfo.name,
            comment: text,
        });
    })
    .then(db.insert('operation_log'+constr.SQL_VERSION))
}

/*********************vm snapshot add order*******************************/
Vm_Snapshot.prototype.addOrder = function(){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(data, onFullfilled){
        if (Q.getData('asyncState') != constr.OPT.SUCCESS){
            Q.reject();
        }
        onFullfilled();
    }).then(function(data, onFullfilled){
        var userid = Q.getData('userid');
        var snapshot_lcuuid = Q.getData('snapshot_lcuuid');
        var snapshot_name = Q.getData('snapshot_name');
        var vm_name = Q.getData('vmname');
        var response = {opt_status: constr.OPT.SUCCESS, data:{}};
        var vmInfo = Q.getData('vmInfo');
        var snapshot_charge = [{}];

        snapshot_charge[0].OBJ_LCUUID = snapshot_lcuuid;
        snapshot_charge[0].INSTANCE_LCUUID = vmInfo.lcuuid;
        snapshot_charge[0].SIZE = vmInfo.sys_disk_size + vmInfo.user_disk_size;
        snapshot_charge[0].PS_LCUUID = Q.getData('queryParam').PRODUCT_SPECIFICATION_LCUUID,
        snapshot_charge[0].NAME = snapshot_name;
        snapshot_charge[0].MDF_FLAG = false;
        response.data.SNAPSHOTS = snapshot_charge;

        response.data.USERID = userid;
        response.data.DOMAIN = constr.getOssDomain();;
        response.user_id = userid;
        response.domain = constr.getOssDomain();;
        response.autoconfirm = 1;
        response.isconfirmed = 2;
        response.content =  JSON.stringify({snapshot:[{vm_name: vm_name,
                                                    name: snapshot_name,
                                                    size: snapshot_charge[0].SIZE,
                                                    lcuuid: snapshot_lcuuid}]});
        Obj.prototype.getSession(userid, function(user){
            if (user != null && user.length > 0) {
                response.session = user[0].session;
                response.data.USERUUID = user[0].useruuid;
                response.useruuid = user[0].useruuid;
                response.data = JSON.stringify(response.data);
                Obj.prototype.callbackWeb('/order/addorder', 'post',response, function(sCode,order_data){
                    if (sCode == 200){
                        logger.info('Insert snapshot order success');
                    } else {
                        logger.info('Insert snapshot order failed');
                        Q.reject(constr.OPT.FAIL);
                    }
                    onFullfilled();
                });
             }
        },function(){logger.info('snapshot unable add order cause getting session failed');});
    })

}

/*********************vm snapshot add order*******************************/
Vm_Snapshot.prototype.stopCharge = function(){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(data, onFullfilled){
        var type = 'snapshots';
        var userid = Q.getData('userid');
        var domain = Q.getData('domain');
        var snapshot_lcuuid = Q.getData('snapshot_lcuuid');
        var useruuid = '';

        Obj.prototype.getSession(userid, function(user){
            if (user != null && user.length > 0) {
                useruuid = user[0].useruuid;
                Obj.prototype.callCharge('/charges/?DOMAIN=' + domain +'&TYPE=' + type + '&LCUUID=' + snapshot_lcuuid + '&USERUUID=' + useruuid, 'delete',{},function(sCode,order_data){
                    if (sCode == 200){
                        logger.info('Stop snapshot charge success');
                    } else {
                        logger.info('Stop snapshot charge failed');
                        Q.reject(constr.OPT.FAIL);
                    }
                    onFullfilled();
                });
             }
        },function(){logger.info('snapshot unable stop charge cause getting session failed');});
    })
}

module.exports = Vm_Snapshot;
