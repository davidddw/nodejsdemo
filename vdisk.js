var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var Instance = require('./instance.js');
var lc_utils = require('./lc_utils.js');

var Vdisk = function(){
    Obj.call(this);
    this.tableCols = [
        'name',
        'userid'
    ];
}
util.inherits(Vdisk, Obj);
Vdisk.prototype.state = {
};
Vdisk.prototype.tableName = 'fdb_vm_v2_2';
Vdisk.prototype.type = 'vdisk';
Vdisk.prototype.constructor = Vdisk;
Vdisk.prototype.parseBdbToFdbData = function(data){
    var ans = {DATA:{}, DESCRIPTION:data.DESCRIPTION, OPT_STATUS:data.OPT_STATUS};
    ans.DATA.vm_lcuuid = lc_utils.bget(data.DATA, 'VM_LCUUID');
    ans.DATA.vdisk_size = lc_utils.bget(data.DATA, 'SIZE');
    ans.TYPE = 'vdisk';
    return ans;
}

Vdisk.prototype.modifyvdisk = function(data, callback, errorcallback){
    logger.debug('modify vm '+data.id+' vdisksize');
    var p = this;
    if (!'vdisk_size' in data){
        errorcallback(400);
    }
    //data = p.parseApiToFdbData(data);
    p.action = 'modifyvdisk';
    p.selectSql(
        ['fdb_vm_v2_2', 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                p.data.userid = ans[0].userid;
                p.sendData('/v1/ha-disks', 'get', {vm_lcuuid:data.lcuuid}, function(sCode, rans){
                        if (sCode == 404 || rans.DATA.length == 0){
                            var method = 'post';
                            var url = '/v1/ha-disks';
                            var request_data = {'VM_LCUUID':data.lcuuid, 'SIZE':data.vdisk_size};
                        } else{
                            var method = 'patch'
                            var url = '/v1/ha-disks/'+rans.DATA[0].LCUUID;
                            var request_data = {'SIZE':data.vdisk_size};
                        }
                        p.sendData(url, method, request_data, function(sCode, rdata){
                            if (rdata.OPT_STATUS == 'SUCCESS'){
                                callback(rdata);
                            } else{
                                errorcallback(sCode);
                            }
                        }, errorcallback);
                    },
                    errorcallback
                )
            } else{
                errorcallback(404, {ERR_MSG:'vm not found'});
            }
        },
        errorcallback
    );
}
Vdisk.prototype.delvdisk = function(data, callback, errorcallback){
    logger.debug('del vm '+data.vmid+' vdisk');
    var p = this;
    //data = p.parseApiToFdbData(data);
    p.action = 'delvdisk';
    p.selectSql(
        [p.tableName, 'id', data.vmid],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                p.data.userid = ans[0].userid;
                p.sendData('/v1/ha-disks', 'get', {vm_lcuuid:data.lcuuid}, function(sCode, rans){
                        if (sCode != 404 || rans.DATA.length != 0){
                            p.sendData('/v1/ha-disks/'+rans.DATA[0].LCUUID, 'delete', {}, function(sCode, rdata){
                                if (rdata.OPT_STATUS == 'SUCCESS'){
                                    callback(rdata);
                                } else{
                                    errorcallback(sCode);
                                }
                            }, errorcallback);
                        } else{
                            errorcallback(404, ans);
                        }
                    },
                    errorcallback
                )
            }
        },
        errorcallback
    );
}
Vdisk.prototype.unplugvdisk = function(data, callback, errorcallback){
    logger.debug('unplug vm '+data.id+' vdisk');
    var p = this;
    //data = p.parseApiToFdbData(data);
    p.action = 'unplugvdisk';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.userid = ans[0].userid;
                p.sendData('/v1/ha-disks', 'get', {vm_lcuuid:data.lcuuid}, function(sCode, rans){
                        if (sCode != 404 || rans.DATA.length != 0){
                            p.sendData('/v1/ha-disks/'+rans.DATA[0].LCUUID+'/connection', 'delete', {}, function(sCode, rdata){
                                if (rdata.OPT_STATUS == 'SUCCESS'){
                                    callback(rdata);
                                } else{
                                    errorcallback(sCode);
                                }
                            }, errorcallback);
                        } else{
                            errorcallback(400);
                        }
                    },
                    errorcallback
                )
            }
        },
        errorcallback
    );
}
Vdisk.prototype.plugvdisk = function(data, callback, errorcallback){
    logger.debug('plug vm '+data.vmid+' vdisk');
    var p = this;
    //data = p.parseApiToFdbData(data);
    p.action = 'plugvdisk';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.userid = ans[0].userid;
                p.sendData('/v1/ha-disks', 'get', {vm_lcuuid:data.lcuuid}, function(sCode, rans){
                        if (sCode != 404 || rans.DATA.length != 0){
                            p.sendData('/v1/ha-disks/'+rans.DATA[0].LCUUID+'/connection', 'post', {'VM_LCUUID':data.lcuuid}, function(sCode, rdata){
                                if (rdata.OPT_STATUS == 'SUCCESS'){
                                    callback(rdata);
                                } else{
                                    errorcallback(sCode);
                                }
                            }, errorcallback);
                        } else{
                            errorcallback(400);
                        }
                    },
                    errorcallback
                )
            }
        },
        errorcallback
    );
}

//var a = new Vdisk();
//a.update({id:1004, name:'fsd'}, console.log, console.log);
Vdisk.prototype.default_event_parser = function(data, callback, errorcallback){
     //do not change db
    var p = this;
    //translate isolation, snapshot to db,
    logger.info(data);

    p.sendData('/v1/vms', 'get', {LCUUID:data.vm_lcuuid}, function(sCode, rans){
        if (sCode == 200 && 'DATA' in rans && rans.DATA.length >0){
            var flag = 1;
            rans.DATA.forEach(function(item,index){
                if(item["LCUUID"] == data.vm_lcuuid){
                    flag = item["FLAG"];
                }
            });
            //rans.DATA[0].FLAG
            p.updateSql(
                ['fdb_vm_v2_2', {'flag':flag}, 'lcuuid', data.vm_lcuuid],
                function(rdata){
                    p.sendToMsgCenter({type:'user', target:p.data.userid, msg:{action:p.action, state:'done', type:'vm', id:data.id}});
                },
                errorcallback
            );
        } else{
            errorcallback(200, 'vm '+data.vm_lcuuid+'not found');
        }
    })



}
Vdisk.prototype.sendToDataCenter = function(curData, oriData){

}
module.exports=Vdisk;
