var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var lc_utils = require('./lc_utils.js');
var operationLog = require('./operation_log.js');
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


var Storage = function(){
    Obj.call(this);
}
util.inherits(Storage, Obj);

//return a Qpack
Storage.prototype.create = function(options, syncCallback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    return Q.then(function(placeHolder, onFullfilled){
        options = options ? options : placeHolder;
        onFullfilled({
            'data': lc_utils.upperJsonKey(options),
            'validator': data.storageCreate(),
        })
    })
    .then(data.checkParamsValid('', function (data){
        Q.params = data;
        return {
            'lcuuid': Q.params.PRODUCT_SPECIFICATION_LCUUID,
            'product_type': constr.PRODUCT_TYPES.STORAGE
        };
    }))
    .then(db.fetch('product_specification'+constr.SQL_VERSION, '', function(data){
        return {'type': JSON.parse(data[0].content).block_device_type}
    }))
    //get user info
    .then(function(passData, onFullfilled){
        db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
            Q.setData('userInfo', data[0]);
        }).steps[0]({useruuid: Q.params.USER_LCUUID}, function(){onFullfilled(passData)})
    })
    .then(db.fetch('storage'+constr.SQL_VERSION, '', function(data){
        Q.params.STORAGE_LCUUID = data[0].uuid;
        return Q.params;
    }))
    .then(api.callStorage('POST', 'v1/blocks', ''))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        //Q.setData('asyncData', result);
        Q.setRejectHandler(logger.info);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: Q.getData('userInfo').id,
                msg:{
                    action: 'create', state: 'start',
                    type: 'block_device', lcuuid: result.DATA.LCUUID,
                    data: result.DATA,
                }
            })
            //store creating state in instancePot
            instancePot.store(result.DATA.LCUUID, 'create', {'STATE': 'creating'});
            Q.then(Storage.prototype.onActionDone('BLOCK_DEVICE', 'create', result));
        } else {
            Q.reject();
        }
        //storage create Qpack onFullfilled nothing to a next Qpack (wait for created)
        //since already syncCallback the syncResult
        onFullfilled();
    })
}



//get use async callback for res_return
Storage.prototype.get = function(filter, dataParse){
    var Q = new flow.Qpack(flow.serial);
    dataParse = dataParse ? dataParse : function(){return arguments};
    var lcuuid='';
    if('lcuuid' in filter){
        lcuuid = '/'+filter.lcuuid;
    }
    return Q.then(function(placeHolder, onFullfilled){
        filter = filter ? filter : placeHolder;
        onFullfilled({
            'data': filter,
            'validator': data.storageGet(),
        })
    })
    .then(data.checkParamsValid('', function(data){
        Q.setData('params', data);
        return;
    }))
    .then(db.fetch('product_specification'+constr.SQL_VERSION,
        {product_type: constr.PRODUCT_TYPES.STORAGE},
        function(data){
            Q.setData('psInfo', data);
            return Q.getData('params')
        }
    ))
    .then(api.callStorage('GET', 'v1/blocks' + lcuuid , ''))
    .then(function(data, onFullfilled){
        if (data.code == 200){
            data = data.body;
            if (data.OPT_STATUS == constr.OPT.SUCCESS){
                var psInfo = Q.getData('psInfo');
                var vmLcuuids = [];
                if(data.DATA instanceof  Array){
                    for (var i=0; i<data.DATA.length; i++){
                        var potData = instancePot.get(data.DATA[i].LCUUID);
                        if (potData){
                            for (var action in potData){
                                lc_utils.updateObject(data.DATA[i], potData[action]);
                            }
                        }
                        for(var p=0;p<psInfo.length;p++){
                            if(psInfo[p].lcuuid==data.DATA[i].PRODUCT_SPECIFICATION_LCUUID){
                                data.DATA[i]['PRODUCT_SPECIFICATION_INFO'] = psInfo[p];
                                break;
                            }
                        }
                        if (data.DATA[i].VM_LCUUID){
                            vmLcuuids.push(data.DATA[i].VM_LCUUID);
                        }
                    }
                }else{
                    for(var p=0;p<psInfo.length;p++){
                        if(psInfo[p].lcuuid==data.DATA.PRODUCT_SPECIFICATION_LCUUID){
                            data.DATA['PRODUCT_SPECIFICATION_INFO'] = psInfo[p];
                            break;
                        }
                    }
                    if (data.DATA.VM_LCUUID){
                        vmLcuuids.push(data.DATA.VM_LCUUID);
                    }
                }
                //append vm info
                if (vmLcuuids.length){
                    db.fetch('fdb_vm'+constr.SQL_VERSION, {lcuuid: vmLcuuids}).resolve('', function(vmData){
                        var vmMap = {};
                        if(vmData.length){
                            vmData.forEach(function(i){
                                vmMap[i.lcuuid] = i.name;
                            })
                            if(data.DATA instanceof  Array){
                                for (var i=0; i<data.DATA.length; i++){
                                    data.DATA[i].VM_NAME = vmMap[data.DATA[i].VM_LCUUID];
                                }
                            }else{
                                data.DATA.VM_NAME = vmMap[data.DATA.VM_LCUUID];
                            }
                        }
                        onFullfilled(dataParse({'OPT_STATUS': 'SUCCESS', 'DATA': data.DATA,PAGE:data.PAGE}));
                    })
                }else{
                    onFullfilled(dataParse({'OPT_STATUS': 'SUCCESS', 'DATA': data.DATA,PAGE:data.PAGE}));
                }
            } else {
                onFullfilled(dataParse(data.body));
            }
        } else {
            onFullfilled(dataParse(data,body));
        }
    }).then(function(){

    })
}


//delete has synchronous callback
//current we can only call del in synchronous way since the delete url is assigned synchronously
Storage.prototype.del = function(lcuuid, syncCallback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    return Q.then(function(placeHolder, onFullfilled){
        lcuuid = lcuuid ? lcuuid : placeHolder;
        if (validator.isUUID(lcuuid)){
        } else {
            Q.reject({'OPT_STATUS': constr.OPT.FAIL, 'MSG': 'lcuuid illegal'})
        }
        onFullfilled();
    })
    //set request params
    //get block info
    .then(db.fetch('block_device', {lcuuid: lcuuid}, function(data){
            return {useruuid: data[0].user_lcuuid};
        })
    )
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
            Q.setData('userInfo', data[0]);
        })
    )
    .then(function(result, onFullfilled){
        if (instancePot.get(lcuuid, '')){
            Q.reject();
            syncCallback({'OPT_STATUS': constr.OPT.RESOURCE_STATE_ERROR,
                'DATA': instancePot[lcuuid]})
        }
        onFullfilled()
    })
    //the delete url is set synchronously
    .then(api.callStorage('DEL', 'v1/blocks/'+lcuuid, ''))
    .then(function(result, onFullfilled){
        Q.setRejectHandler(logger.info);
        result = result.body;
        //Q.setData('asyncData', result);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: Q.getData('userInfo').id,
                msg:{
                    action:'delete', state:'start',
                    type: 'block_device', lcuuid: result.DATA.LCUUID,
                    data: result
                }
            })
            //store creating state in instancePot
            syncCallback({'OPT_STATUS': constr.OPT.SUCCESS});
            instancePot.store(result.DATA.LCUUID, 'delete', {'STATE': 'deleting'});
            Q.then(Storage.prototype.onActionDone('BLOCK_DEVICE', 'delete', result));
        } else {
            Q.reject();
        }
        //storage create Qpack onFullfilled nothing to a next Qpack (wait for created)
        //since already syncCallback the syncResult
        onFullfilled();
    })
}



//currently modify can only be synchronous now cause url is synchronously set
Storage.prototype.modify = function(modifyData, syncCallback){
    modifyData = lc_utils.upperJsonKey(modifyData);
    var p = this;
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial)
    Q.setRejectHandler(syncCallback);
    return Q.then(function(placeHolder, onFullfilled){
        //placeHolder is '' now
        onFullfilled({
            'data': modifyData,
            'validator': data.storageModify(),
        })
    })
    .then(data.checkParamsValid())
    //check block state
    //get user info
    //get block info
    .then(function(data, onFullfilled){
        Q.setData('params', data);
        onFullfilled({lcuuid: data.LCUUID});
    })
    .then(db.fetch('block_device', '', function(data){
            return {useruuid: data[0].user_lcuuid};
        })
    )
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
            Q.setData('userInfo', data[0]);
            return Q.getData('params');
        })
    )
    .then(function(result, onFullfilled){
        if (instancePot.get(result.LCUUID, '')){
            Q.reject({'OPT_STATUS': constr.OPT.RESOURCE_STATE_ERROR,
                'DATA': instancePot[result.LCUUID]})
            onFullfilled()
        } else {
            delete result['LCUUID'];
            onFullfilled(result);
        }
    })
    .then(api.callStorage('PATCH', 'v1/blocks/' + modifyData.LCUUID, ''))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        Q.setRejectHandler(logger.info);
        //Q.setData('asyncData', result);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            Obj.prototype.sendToMsgCenter({
                type: 'user', target:Q.getData('userInfo').id,
                msg: {
                    action: 'modify', state: 'start',
                    type: 'block_device', lcuuid: result.DATA.LCUUID,
                    data: result.DATA,
                }
            });
            instancePot.store(result.DATA.LCUUID, 'modify', {'STATE': 'modifying'});
            Q.then(Storage.prototype.onActionDone('BLOCK_DEVICE', 'modify', result));
        } else {
            Q.reject();
        }
        onFullfilled();
    })
}

Storage.prototype.onActionDone = function(type, action, syncResult){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        var result = syncResult ? syncResult : placeHolder;
        instancePot._event.once(type + result.DATA.LCUUID + action,
            function(asyncResData){
                Q.setData('asyncData', asyncResData);
                if (asyncResData.OPT_STATUS != constr.OPT.SUCCESS ||
                    ('ERRNO' in asyncResData.DATA && asyncResData.DATA.ERRNO != 0)){
                    if(action == 'plug_block' || action == 'unplug_block'){
                        if(action=='plug_block'){
                            var data = {STATE:'PLUGFAIL'};
                        }else{
                            var data = {STATE:'UNPLUGFAIL'};
                        }
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'fail',
                                type:'block_device', lcuuid:Q.getData('blockLcuuid'),
                                data:data}
                        })
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'fail',
                                type:'vm_block', lcuuid:asyncResData.DATA.LCUUID,
                                data:data}
                        })
                    }else{
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'fail',
                                type:'block_device', lcuuid:asyncResData.DATA.LCUUID,
                                data:asyncResData.DATA}
                        })
                    }
                    instancePot.remove(result.DATA.LCUUID, action);
                    onFullfilled(constr.OPT.FAIL);
                } else {
                    if (action=='snapshot' ||action=='deletesnapshot' ||action=='reversesnapshot'){
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'success',
                                type:'block_device', lcuuid:asyncResData.DATA.LCUUID,
                                data:asyncResData.DATA.SNAPSHOTS[0]}
                        })
                        logger.info('result------', asyncResData, result, instancePot._actionContainer);
                        instancePot.remove(result.DATA.LCUUID, action);
                        onFullfilled(constr.OPT.SUCCESS);
                    } else if (action == 'plug_block' || action == 'unplug_block'){
                        if (action == 'plug_block'){
                            var stateData = {'STATE': 'SUCCESS', 'vm':Q.getData('vmInfo')};
                        } else if (action == 'unplug_block'){
                            var stateData = {'STATE': 'SUCCESS', 'vm':''};
                        }
                        //for update vm
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'success',
                                type:'vm_block', lcuuid: Q.getData('vmInfo').LCUUID,
                                data: stateData}
                        })
                        //for update block
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'success',
                                type:'block_device', lcuuid: Q.getData('blockLcuuid'),
                                data: stateData}
                        })
                        instancePot.remove(Q.getData('vmInfo').LCUUID, action);
                        onFullfilled(constr.OPT.SUCCESS);
                    } else {
                        Obj.prototype.sendToMsgCenter({
                            type:'user', target:Q.getData('userInfo').id,
                            msg:{action: action, state: 'success',
                                type:'block_device', lcuuid:asyncResData.DATA.LCUUID,
                                data:asyncResData.DATA}
                        })
                        instancePot.remove(result.DATA.LCUUID, action);
                        onFullfilled(constr.OPT.SUCCESS);
                    }
                }
            }
        )
    })
}

Storage.prototype.snapshot = function(options, syncCallback){
    options = lc_utils.upperJsonKey(options);
    var lcuuid = options.LCUUID
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    //placeHolder is null here
    return Q.then(function(placeHolder, onFullfilled){
        onFullfilled({
            'data': options,
            'validator': data.storageSnapshot(),
        });
    })
    .then(data.checkParamsValid('', function (data){
        delete(data['LCUUID']);
        Q.setData('params', data);
    }))
    .then(db.fetch('block_device', {lcuuid: lcuuid}, function(data){
            Q.setData('blockInfo', data[0]);
            return {useruuid: data[0].user_lcuuid};
        })
    )
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
            Q.setData('userInfo', data[0]);
            return Q.getData('params');
        })
    )
    //the snapshot url is set synchronously;
    .then(api.callStorage('POST', 'v1/blocks/'+lcuuid+'/snapshots', ''))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        Q.setData('asyncData', result);
        Q.setRejectHandler(logger.info);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            Obj.prototype.sendToMsgCenter({
                type: 'user', target:Q.getData('userInfo').id,
                msg: {
                    action: 'snapshot', state: 'start',
                    type: 'block_device', lcuuid: result.DATA.LCUUID,
                    data: result.DATA.SNAPSHOTS[0],
                }
            });
            instancePot.store(result.DATA.LCUUID, 'snapshot', {'STATE': 'snapshotting'});
            Q.then(Storage.prototype.onActionDone('BLOCK_DEVICE', 'snapshot', result));
        } else {
            Q.reject();
        }
        onFullfilled();
    })
}

Storage.prototype.delSnapshot = function(blockLcuuid, snapshotLcuuid, syncCallback){
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        Q.setRejectHandler(syncCallback);
        if (validator.isUUID(blockLcuuid) && validator.isUUID(snapshotLcuuid)){
        } else {
            syncCallback({'OPT_STATUS': constr.OPT.FAIL, 'MSG': 'lcuuid illegal'})
            Q.reject();
        }
        onFullfilled();
    })
    .then(db.fetch('block_device', {lcuuid: blockLcuuid}, function(data){
            Q.setData('blockInfo', data[0])
            return {useruuid: data[0].user_lcuuid};
        })
    )
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
            Q.setData('userInfo', data[0]);
        })
    )
    .then(function(result, onFullfilled){
        if (instancePot.get(blockLcuuid, '')){
            Q.reject();
            syncCallback({'OPT_STATUS': constr.OPT.RESOURCE_STATE_ERROR,
                'DATA': instancePot[blockLcuuid]})
        }
        onFullfilled()
    })
    .then(api.callStorage('GET', 'v1/blocks/'+blockLcuuid+'/snapshots/'+snapshotLcuuid, '', function(data){
        Q.setData('snapshotInfo', data.body.DATA);
        return;
    }))
    //the snapshot url is set synchronously;
    .then(api.callStorage('DEL', 'v1/blocks/'+blockLcuuid+'/snapshots/'+snapshotLcuuid, '', function(data){
        Q.setData('syncData', data);
        return;
    }))
    .then(function(result, onFullfilled){
        result = Q.getData('syncData').body;
        syncCallback(result);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            Obj.prototype.sendToMsgCenter({
                type: 'user', target:Q.getData('userInfo').id,
                msg: {
                    action: 'deletesnapshot', state: 'start',
                    type: 'block_device', lcuuid: result.DATA.LCUUID,
                    data: result.DATA.SNAPSHOTS[0],
                }
            });
            instancePot.store(result.DATA.LCUUID, 'deletesnapshot',
                {'STATE': 'deletesnapshotting'});
            Q.then(Storage.prototype.onActionDone('BLOCK_DEVICE', 'deletesnapshot', result));
        } else {
            Q.reject();
        }
        onFullfilled();
    })
}
//get use async callback for res_return
Storage.prototype.get_snapshots = function(filter, dataParse){
    var Q = new flow.Qpack(flow.serial);
    dataParse = dataParse ? dataParse : function(){return arguments};
    filter = lc_utils.upperJsonKey(filter);
    var lcuuid = '',snapshot_lcuuid='';
    lcuuid = filter.BLOCK_LCUUID;
    if('SNAPSHOT_LCUUID' in filter){
        snapshot_lcuuid = '/'+filter.SNAPSHOT_LCUUID;
    }
    return Q.then(function(placeHolder, onFullfilled){
        filter = filter ? filter : placeHolder;
        onFullfilled({
            'data': filter,
            'validator': data.storageSnapshotGet(),
        })
    })
    .then(data.checkParamsValid())
    .then(api.callStorage('GET', 'v1/blocks/'+lcuuid+'/snapshots'+snapshot_lcuuid, ''))
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

Storage.prototype.reverseSnapshot = function(blockLcuuid, snapshotLcuuid, syncCallback){
    syncCallback = syncCallback ? syncCallback : function(){return arguments};
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        Q.setRejectHandler(syncCallback);
        lcuuid = blockLcuuid ? blockLcuuid : placeHolder;
        if (validator.isUUID(blockLcuuid) && validator.isUUID(snapshotLcuuid)){
        } else {
            syncCallback({'OPT_STATUS': constr.OPT.FAIL, 'MSG': 'lcuuid illegal'})
            Q.reject();
        }
        onFullfilled();
    })
    .then(db.fetch('block_device', {lcuuid: blockLcuuid}, function(data){
            Q.setData('blockInfo', data[0]);
            return {useruuid: data[0].user_lcuuid};
        })
    )
    //get user info
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
            Q.setData('userInfo', data[0]);
        })
    )
    .then(function(result, onFullfilled){
        if (instancePot.get(blockLcuuid, '')){
            Q.reject();
            syncCallback({'OPT_STATUS': constr.OPT.RESOURCE_STATE_ERROR,
                'DATA': instancePot[blockLcuuid]})
        }
        onFullfilled()
    })
    .then(api.callStorage('GET', 'v1/blocks/'+blockLcuuid+'/snapshots/'+snapshotLcuuid, '', function(data){
        Q.setData('snapshotInfo', data.body.DATA);
        return;
    }))
    //the snapshot url is set synchronously;
    .then(api.callStorage('POST',
        'v1/blocks/'+blockLcuuid+'/snapshots/'+snapshotLcuuid+'/reversion'))
    .then(function(result, onFullfilled){
        result = result.body;
        syncCallback(result);
        if (result['OPT_STATUS'] == constr.OPT.SUCCESS){
            Obj.prototype.sendToMsgCenter({
                type: 'user', target:Q.getData('userInfo').id,
                msg: {
                    action: 'reversesnapshot', state: 'start',
                    type: 'block_device', lcuuid: result.DATA.LCUUID,
                    data: result.DATA.SNAPSHOTS[0],
                }
            });
            instancePot.store(result.DATA.LCUUID, 'reversesnapshot',
                {'STATE': 'reversesnapshotting'});
            Q.then(Storage.prototype.onActionDone('BLOCK_DEVICE', 'reversesnapshot', result));
        } else {
            Q.reject();
        }
        onFullfilled();
    })
}

Storage.prototype.plugToVm = function(vmLcuuid, blockLcuuid, syncCallback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    return Q.then(function(data, onFullfilled){
        if (!validator.isUUID(vmLcuuid) || !validator.isUUID(blockLcuuid)){
            Q.reject({OPT_STATUS: constr.OPT.INVALID_POST_DATA})
        }
        //未来使用 instancePot.getState来返回当前状态
        if (instancePot.get(vmLcuuid, '')){
            Q.reject({OPT_STATUS: constr.OPT.VM_IS_PLUGGING_BLOCK})
        }
        Q.setData('blockLcuuid', blockLcuuid);
        onFullfilled();
    })
    //get pluged blocks
    .then(api.callStorage('GET', 'v1/blocks/', {'vm-lcuuid': vmLcuuid}))
    .then(function(blocks, onFullfilled){
        var data = blocks.body.DATA;
        var index = 1;
        if (data.length > 0){
            var devices = {};
            data.forEach(function(block){
                devices[block.DEVICE] = 1;
            })
            while (index in devices){
                index++;
            }
        }
        onFullfilled({
            'BLOCK_LCUUID': blockLcuuid,
            'DEVICE': index
        });
    })
    .then(api.callVMSnapshot('POST', 'v1/vms/'+vmLcuuid+'/blocks/'))
    .then(function(data, onFullfilled){
        data = data.body;
        syncCallback(data);
        Q.setRejectHandler(logger.info);
        Q.setData('syncData', data);
        onFullfilled();
    })
    //get blockInfo
    .then(api.callStorage('GET', 'v1/blocks/'+blockLcuuid))
    .then(function(data, onFullfilled){
        Q.setData('blockInfo', data.body.DATA)
        onFullfilled();
    })
    //get vmInfo
    .then(api.callVMSnapshot('GET', 'v1/vms/'+vmLcuuid))
    .then(function(vmInfo, onFullfilled){
        Q.setData('vmInfo', vmInfo.body.DATA);
        onFullfilled({'id': vmInfo.body.DATA.USERID});
    })
    //get userInfo
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
        Q.setData('userInfo', data[0]);
        return
    }))
    .then(function(data, onFullfilled){
        data = Q.getData('syncData');
        logger.info('asdfasdf', data);
        if (data.OPT_STATUS == constr.OPT.SUCCESS){
            //for update vm
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: Q.getData('vmInfo').USERID,
                msg:{
                    action: 'plug', state: 'start',
                    type: 'vm_block', lcuuid: vmLcuuid,
                    data: {STATE: 'PLUGGING'},
                }
            })
            //for update block
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: Q.getData('vmInfo').USERID,
                msg:{
                    action: 'plug', state: 'start',
                    type: 'block_device', lcuuid: blockLcuuid,
                    data: {STATE: 'PLUGGING'},
                }
            })
            //store creating state in instancePot
            instancePot.store(vmLcuuid, 'plug_block', {'STATE': 'plug'});
            data.DATA = {'LCUUID': vmLcuuid};
            Q.then(Storage.prototype.onActionDone('VM_BLOCK', 'plug_block', data));
        } else {
            Q.reject();
        }
        onFullfilled();
    })

}

Storage.prototype.unplugFromVm = function(vmLcuuid, blockLcuuid, syncCallback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(syncCallback);
    return Q.then(function(data, onFullfilled){
        if (!validator.isUUID(vmLcuuid) || !validator.isUUID(blockLcuuid)){
            Q.reject({OPT_STATUS: constr.OPT.INVALID_POST_DATA})
        }
        //未来使用 instancePot.getState来返回当前状态
        if (instancePot.get(vmLcuuid, '')){
            Q.reject({OPT_STATUS: constr.OPT.VM_IS_PLUGGING_BLOCK})
        }
        Q.setData('blockLcuuid', blockLcuuid);
        onFullfilled();
    })
    .then(api.callVMSnapshot('DEL', 'v1/vms/'+vmLcuuid+'/blocks/'+blockLcuuid))
    .then(function(data, onFullfilled){
        data = data.body;
        syncCallback(data);
        Q.setRejectHandler(logger.info);
        Q.setData('asyncData', data);
        onFullfilled();
    })
    //get blockInfo
    .then(api.callStorage('GET', 'v1/blocks/'+blockLcuuid))
    .then(function(data, onFullfilled){
        Q.setData('blockInfo', data.body.DATA);
        onFullfilled();
    })
    //get vmInfo
    .then(api.callVMSnapshot('GET', 'v1/vms/'+vmLcuuid))
    .then(function(vmInfo, onFullfilled){
        Q.setData('vmInfo', vmInfo.body.DATA);
        onFullfilled({'id': vmInfo.body.DATA.USERID});
    })
    //get userInfo
    .then(db.fetch('fdb_user'+constr.SQL_VERSION, '', function(data){
        Q.setData('userInfo', data[0]);
        return
    }))
    .then(function(data, onFullfilled){
        data = Q.getData('asyncData');
        if (data.OPT_STATUS == constr.OPT.SUCCESS){
            //for update vm
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: Q.getData('vmInfo').USERID,
                msg:{
                    action: 'unplug', state: 'start',
                    type: 'vm_block', lcuuid: vmLcuuid,
                    data: {STATE: 'UNPLUGGING'},
                }
            })
            //for update block
            Obj.prototype.sendToMsgCenter({
                type: 'user', target: Q.getData('vmInfo').USERID,
                msg:{
                    action: 'unplug', state: 'start',
                    type: 'block_device', lcuuid: blockLcuuid,
                    data: {STATE: 'UNPLUGGING'},
                }
            })
            //store creating state in instancePot
            instancePot.store(vmLcuuid, 'unplug_block', {'STATE': 'unplug'});
            data.DATA = {LCUUID:vmLcuuid};
            Q.then(Storage.prototype.onActionDone('VM_BLOCK', 'unplug_block', data));
        } else {
            Q.reject();
        }
        onFullfilled();
    })

}

/**************block device operation log***************/
Storage.prototype.addLog = function(data, comment){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(state, onFullfilled){
        state = (state == constr.OPT.SUCCESS) ? 1 : 2;
        Q.setData('state', state);
        onFullfilled({useruuid: Q.getData('userInfo').useruuid});
    })
    .then(function(placeHolder, onFullfilled){
        var asyncData = Q.getData('asyncData');
        var userInfo = Q.getData('userInfo');
        var text = util.format(comment, asyncData.DATA.ALIAS);
        Obj.prototype.sendToMsgCenter({
            type: 'user', target: Q.getData('userInfo').id,
            msg:{
                type: 'output',
                state: Q.getData('state'),
                text: text,
            }
        })
        onFullfilled({
            objecttype: 'block_device',
            objectid: asyncData.DATA.LCUUID,
            object_userid: userInfo.id,
            opt_result: Q.getData('state'),
            start_time: Q.getData('startTime'),
            end_time: new Date().toMysqlFormat(),
            operator_name: Q.getData('operatorName'),
            name: asyncData.DATA.ALIAS,
            comment: text
        });
    })
    .then(db.insert('operation_log'+constr.SQL_VERSION))
}
Storage.prototype.addSnapshotLog = function(data, comment){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(state, onFullfilled){
        state = (state == constr.OPT.SUCCESS) ? 1 : 2;
        Q.setData('state', state);
        onFullfilled({useruuid: Q.getData('userInfo').useruuid});
    })
    .then(function(placeHolder, onFullfilled){
        var blockInfo = Q.getData('blockInfo');
        var userInfo = Q.getData('userInfo');
        if (!Q.getData('snapshotInfo')){
            var snapshotInfo = Q.getData('asyncData').DATA.SNAPSHOTS[0];
        } else {
            var snapshotInfo = Q.getData('snapshotInfo');
        }
        logger.info('snapshot info', blockInfo, snapshotInfo);
        var text = util.format(comment, blockInfo.alias);//, snapshotInfo.NAME);
        Obj.prototype.sendToMsgCenter({
            type: 'user', target: userInfo.id,
            msg:{
                type: 'output',
                state: Q.getData('state'),
                text: text,
            }
        })
        onFullfilled({
            objecttype: 'block_device',
            objectid: blockInfo.lcuuid,
            object_userid: userInfo.id,
            opt_result: Q.getData('state'),
            start_time: Q.getData('startTime'),
            end_time: new Date().toMysqlFormat(),
            operator_name: Q.getData('operatorName'),
            name: snapshotInfo.NAME,
            comment: text
        });
    })
    .then(db.insert('operation_log'+constr.SQL_VERSION))
}
Storage.prototype.addPlugLog = function(data, comment){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(state, onFullfilled){
        state = (state == constr.OPT.SUCCESS) ? 1 : 2;
        Q.setData('state', state);
        var vmInfo = Q.getData('vmInfo');
        var userInfo = Q.getData('userInfo');
        var blockInfo = Q.getData('blockInfo');
        var text = util.format(comment, vmInfo.NAME);//, blockInfo.ALIAS);
        Obj.prototype.sendToMsgCenter({
            type: 'user', target: userInfo.id,
            msg:{
                type: 'output',
                state: Q.getData('state'),
                text: text,
            }
        })
        onFullfilled({
            objecttype: 'vm',
            objectid: vmInfo.LCUUID,
            object_userid: userInfo.id,
            opt_result: Q.getData('state'),
            start_time: Q.getData('startTime'),
            end_time: new Date().toMysqlFormat(),
            operator_name: Q.getData('operatorName'),
            name: vmInfo.NAME,
            comment: text
        });
    })
    .then(db.insert('operation_log'+constr.SQL_VERSION))
}


/*********************block add order*******************************/
Storage.prototype.addOrder = function(){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(data, onFullfilled){
        if (Q.getData('state') == 2){
            Q.reject();
        }
        onFullfilled();
    }).then(function(data, onFullfilled){
        var userInfo = Q.getData('userInfo');
        var asyncData = Q.getData('asyncData');
        var response = {opt_status: constr.OPT.SUCCESS, data:{}};
        response.data.ORDER_ID = 0;
        response.data.USERID = userInfo.id;
        response.data.DOMAIN = constr.getOssDomain();
        response.user_id = userInfo.id;
        response.domain = constr.getOssDomain();
        response.autoconfirm = 1;
        response.isconfirmed = 2;
        response.content =  JSON.stringify({block_device:[{name: asyncData.DATA.ALIAS,
            lcuuid: asyncData.DATA.LCUUID, size: asyncData.DATA.SIZE}]});
        Obj.prototype.getSession(userInfo.id, function(user){
            if (user != null && user.length > 0) {
                response.session = user[0].session;
                response.data.USERUUID = user[0].useruuid;
                response.useruuid = user[0].useruuid;
                response.data = JSON.stringify(response.data);
                Obj.prototype.callbackWeb('/order/addorder', 'post',response, function(sCode,order_data){
                    if (sCode == 200){
                        logger.info('Insert block device order success');
                    } else {
                        logger.info('Insert block device order failed');
                        Q.reject(constr.OPT.FAIL);
                    }
                    onFullfilled();
                });
             }
        },function(){logger.info('snapshot unable add order cause getting session failed');});
    })
};
Storage.prototype.addMofidyOrder = function(){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(data, onFullfilled){
        var userInfo = Q.getData('userInfo');
        var asyncData = Q.getData('asyncData');
        var response = {opt_status: constr.OPT.SUCCESS, data:{}};
        response.data.ORDER_ID = 0;
        response.data.USERID = userInfo.id;
        response.data.DOMAIN = constr.getOssDomain();
        response.user_id = userInfo.id;
        response.domain = constr.getOssDomain();
        response.autoconfirm = 1;
        response.isconfirmed = 2;
        response.content =  JSON.stringify({block_device_mdf:['云硬盘'+asyncData.DATA.ALIAS+'扩容到 '+ asyncData.DATA.SIZE/1024 +'G']});
        Obj.prototype.getSession(userInfo.id, function(user){
            if (user != null && user.length > 0) {
                response.session = user[0].session;
                response.data.USERUUID = user[0].useruuid;
                response.useruuid = user[0].useruuid;
                response.data = JSON.stringify(response.data);
                Obj.prototype.callbackWeb('/order/addorder', 'post',response, function(sCode,order_data){
                    if (sCode == 200){
                        logger.info('Insert block device order success');
                    } else {
                        logger.info('Insert block device order failed');
                        Q.reject(constr.OPT.FAIL);
                    }
                    onFullfilled();
                });
             }
        },function(){logger.info('snapshot unable add order cause getting session failed');});
    })
};

Storage.prototype.addSnapshotOrder = function(){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(data, onFullfilled){
        var userInfo = Q.getData('userInfo');
        var blockInfo = Q.getData('blockInfo');
        var snapshotInfo = Q.getData('asyncData').DATA.SNAPSHOTS[0];
        var response = {opt_status: constr.OPT.SUCCESS, data:{}};
        response.data.ORDER_ID = 0;
        response.data.USERID = userInfo.id;
        response.data.DOMAIN = constr.getOssDomain();
        response.user_id = userInfo.id;
        response.domain = constr.getOssDomain();
        response.autoconfirm = 1;
        response.isconfirmed = 2;
        response.content =  JSON.stringify({block_device:[{name: snapshotInfo.NAME,
            lcuuid: snapshotInfo.LCUUID, size: snapshotInfo.SIZE}]});
        Obj.prototype.getSession(userInfo.id, function(user){
            if (user != null && user.length > 0) {
                response.session = user[0].session;
                response.data.USERUUID = user[0].useruuid;
                response.useruuid = user[0].useruuid;
                response.data = JSON.stringify(response.data);
                Obj.prototype.callbackWeb('/order/addorder', 'post',response, function(sCode,order_data){
                    if (sCode == 200){
                        logger.info('Insert block device snapshot order success');
                    } else {
                        logger.info('Insert block device snapshot order failed');
                        Q.reject(constr.OPT.FAIL);
                    }
                    onFullfilled();
                });
             }
        },function(){logger.info('snapshot unable add order cause getting session failed');});
    })
};


module.exports = Storage;
