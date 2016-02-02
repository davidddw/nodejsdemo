var logger = require('./logger.js');
var constr = require('./const.js');
var util = require('util');
var Obj = require('./obj.js');
var flow = require('./flow.js');
var lc_utils = require('./lc_utils.js');
var Vm = require('./vm.js');
var dataFormat = require('./data.js');
var api = require('./api.js');
var Task = require('./task.js');

var Pack = function(){
    Obj.call(this);
}

util.inherits(Pack, Obj);


Pack.prototype.get_pack_pool = function(data, callback, errorcallback){

    var rdata = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f){
        var rvmware = {'TYPE': constr.PACK_POOL_TYPE_VMWARE, 'NAME': 'vmware'};
        var r2cloud = {'TYPE': constr.PACK_POOL_TYPE_2CLOUD, 'NAME': '2cloud-私有云'};
        var razure = {'TYPE': constr.PACK_POOL_TYPE_AZURE, 'NAME': 'azure'};

        rdata.OPT_STATUS = constr.OPT.SUCCESS;
        rdata.DESCRIPTION = '';

        rdata.DATA = [rvmware, r2cloud, razure];
        callback(rdata);
        f(a);
    });

    app.fire('', function(){});
}

Pack.prototype.get_pack_pool_info = function(data, callback, errorcallback){

    var p = this;
    var pool_table = 'pool_v2_2';
    var domain_table = 'domain_v2_2';
    var host_table = 'host_device_v2_2';
    var vcenter_table = 'vc_server_v2_2';
    var vctcon = 'select * from ??';
    var domaincon = 'select * from ?? where role=2'
    var hostcon = 'select count(id) as num from ?? where htype=2';
    var poolcon = 'select lcuuid,ctype from ?? where type=1 and ctype<>2';
    var vc_host = 0;
    // vmware learn send data
    var vmlsdata = {};
    var res = {};
    var rdata = {};
    var pools = null;
    var cpu_total = 0;
    var cpu_used = 0;
    var mem_total = 0;
    var mem_used = 0;
    var disk_total = 0;
    var disk_used = 0;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    // check type
    flow_steps.push(function(a, f){
        if ( !('type' in data) ) {
            errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL,DESCRIPTION: 'no type in request'});
            app.STD_END();
        }
        f(a);
    });

    flow_steps.push(function(a, f) {
        if (data.type == constr.PACK_POOL_TYPE_VMWARE){
            // get domain for vmware learn
            p.executeSql(domaincon)([domain_table],
                function(ans){
                    if (ans.length > 0) {
                        vmlsdata.DOMAIN = ans[0].lcuuid;
                    }
                    else {
                        logger.error('can not find domain');
                        errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'can not find domain'});
                        app.STD_END();
                    }
                    f(a);
                },function(a){errorcallback(a); app.STD_END();f(a);}
            );
        }
        else if (data.type == constr.PACK_POOL_TYPE_2CLOUD) {
            // get pool uuid
            p.executeSql(poolcon)([pool_table],
                function(ans){
                    if (ans.length > 0) {
                        pools = ans;
                    }
                    else {
                        logger.error('can not find pool');
                        errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'can not find pool'});
                        app.STD_END();
                    }
                    f(a);
                },function(a){errorcallback(a); app.STD_END();f(a);}
            )
        }
    });

    flow_steps.push(function(a, f){
        if (data.type == constr.PACK_POOL_TYPE_VMWARE){
            // get id,ip,name,password for vmware learn
            p.executeSql(vctcon)([vcenter_table],
                function(ans){
                    if (ans.length > 0) {
                        vmlsdata.VC_ID = ans[0].id;
                        vmlsdata.VCENTER_IP = ans[0].ip;
                        vmlsdata.VC_USERNAME = ans[0].username;
                        vmlsdata.VC_PASSWORD = ans[0].passwd;
                        f(a);
                    }
                    else {
                        logger.error('no vcserver find');
                        res.OPT_STATUS = constr.OPT.SUCCESS;
                        res.DESCRIPTION = '';
                        rdata.TYPE = constr.PACK_POOL_TYPE_VMWARE;
                        rdata.NAME = data.name;
                        rdata['SERVER-NUM'] = 0;
                        res.DATA = rdata;
                        callback(res);
                        app.STD_END();
                        f(a);
                    }
                },function(a){errorcallback(a); app.STD_END();f(a);}
            )
        }
        else if (data.type == constr.PACK_POOL_TYPE_2CLOUD) {
            // do nothing
            f(a);
        }
    });

    flow_steps.push(function(a, f){
        if (data.type == constr.PACK_POOL_TYPE_VMWARE){
            // post vmware learn
            p.sendData('/v1/vmware/vm/learn/', 'post', vmlsdata,
                function(sCode, rdata) {f(a);},
                function(a) {}
            );
        }
        else if (data.type == constr.PACK_POOL_TYPE_2CLOUD) {
            var inner_flow_steps = [];
            for (var idx=0;idx<pools.length;idx++) {
                var filter = {};
                filter['pool-lcuuid'] = pools[idx].lcuuid;
                var ctype = pools[idx].ctype;
                (function(filter, ctype){
                inner_flow_steps.push(
                    function(a, f){
                        p.sendData('/v1/server-resources/', 'get', filter,
                            function(sCode, rdata) {
                                var data = null;
                                for (var i=0; i<rdata.DATA.length; i++) {
                                    data = rdata.DATA[i];
                                    cpu_total += parseInt(data.CPU_INFO);
                                    cpu_used += data.CPU_USED;
                                    mem_total += data.MEM_TOTAL;
                                    mem_used += data.MEM_USED;
                                    // kvm pool
                                    if (ctype == 3) {
                                        // kvm的返回值中DISK的单位是M
                                        disk_total = parseInt(data.DISK_TOTAL/1024);
                                        disk_used = parseInt(data.DISK_USED/1024);
                                    }
                                    // not kvm pool
                                    else {
                                        // 非kvm的返回值中DISK的单位是G
                                        disk_total += data.DISK_TOTAL;
                                        disk_used += data.DISK_USED;
                                    }
                                }
                                f(a);
                            },
                            function() {f(a)}
                        );
                    }
                )
                })(filter, ctype)
            }
            var inner_flow = new flow.parallel(inner_flow_steps);
            inner_flow.fire('', function(){f(a)})
        }
    });

    // resources info
    flow_steps.push(function(a, f){
        res.OPT_STATUS = constr.OPT.SUCCESS;
        res.DESCRIPTION = '';
        if (data.type == constr.PACK_POOL_TYPE_VMWARE){
            p.executeSql(hostcon)([host_table],
                function(ans){
                    if (ans.length > 0) {
                        vc_host = ans[0].num;
                    }
                    rdata.TYPE = constr.PACK_POOL_TYPE_VMWARE;
                    rdata.NAME = data.name;
                    rdata['SERVER-NUM'] = vc_host;
                    res.DATA = rdata;
                    callback(res);
                    f(a);
                },function(a){errorcallback(a); app.STD_END();f(a);}
            );
        }
        else if (data.type == constr.PACK_POOL_TYPE_2CLOUD){
            var rserverinfo = {};
            rserverinfo.CPU_TOTAL = cpu_total;
            rserverinfo.CPU_USED = cpu_used;
            rserverinfo.MEM_TOTAL = mem_total;
            rserverinfo.MEM_USED = mem_used;
            rserverinfo.DISK_TOTAL = disk_total;
            rserverinfo.DISK_USED = disk_used;
            rdata.TYPE = constr.PACK_POOL_TYPE_2CLOUD;
            rdata.NAME = data.name;
            rdata.SERVERINFO = rserverinfo;
            res.DATA = rdata;
            callback(res);
            f(a);
        }
    });

    app.fire('', function(){});
}

Pack.prototype.vmware_learn_timer = function() {
    var p = this;

    var domain_table = 'domain_v2_2';
    var vcenter_table = 'vc_server_v2_2';
    var vctcon = 'select * from ??';
    var domaincon = 'select * from ?? where role=2';
    var vmlsdata = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    // get domain for vmware learn
    flow_steps.push(function(a, f) {
        p.executeSql(domaincon)([domain_table],
            function(ans){
                if (ans.length > 0) {
                    vmlsdata.DOMAIN = ans[0].lcuuid;
                }
                else {
                    logger.debug('can not find domain');
                    app.STD_END();
                }
                f(a);
            },function(a){app.STD_END();f(a);}
        );
    });
    // get ip,name,password for vmware learn
    flow_steps.push(function(a, f){
        p.executeSql(vctcon)([vcenter_table],
            function(ans){
                if (ans.length > 0) {
                    vmlsdata.VC_ID = ans[0].id;
                    vmlsdata.VCENTER_IP = ans[0].ip;
                    vmlsdata.VC_USERNAME = ans[0].username;
                    vmlsdata.VC_PASSWORD = ans[0].passwd;
                }
                else {
                    logger.debug('can not find vcenter');
                    app.STD_END();
                }
                f(a);
            },function(a){app.STD_END();f(a);}
        );
    });
    // post vmware learn
    flow_steps.push(function(a, f){
        p.sendData('/v1/vmware/vm/learn/', 'post', vmlsdata,
            function(sCode, rdata) {f(a);},
            function(a) {f(a);}
        );
    });

    app.fire('', function(){});
}

Pack.prototype.get_portgroups = function(data, callback, errorcallback){

    var p = this;

    var vl2tb = 'vl2_v2_2';
    var pgtabel = 'portgroup_v2_2';
    var usertabel = 'user_v2_2';
    var vl2con = 'select id, name, lcuuid from ??';
    var pgcon = 'select * from ?? where true';
    var usercon = 'select id,username from ??'
    var pgparam = [];
    var res = {};
    var vl2id_to_name = {};
    var vl2id_to_uuid = {};
    var userid_to_name = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    if ('userid' in data) {
        pgcon += ' and ??=?';
        pgparam.push('userid');
        pgparam.push(data.userid);
    }

    if ('lcuuid' in data) {
        pgcon += ' and ??=?';
        pgparam.push('lcuuid');
        pgparam.push(data.lcuuid);
    }

    flow_steps.push(function(a, f){
        p.executeSql(usercon)(
            [usertabel],
            function(ans){
                if (ans.length <= 0) {
                    errorcallback(a); app.STD_END(); f(a);
                }
                for (var i=0; i<ans.length; i++) {
                    userid_to_name[ans[i].id] = ans[i].username;
                }
                f(a);
            },
            function(a){errorcallback(a); app.STD_END(); f(a);}
        );
    });

    flow_steps.push(function(a, f){
        p.executeSql(vl2con)(
            [vl2tb],
            function(ans){
                if (ans.length > 0) {
                    for (var i=0; i<ans.length; i++) {
                        vl2id_to_name[ans[i].id] = ans[i].name;
                        vl2id_to_uuid[ans[i].id] = ans[i].lcuuid;
                    }
                }
                f(a);
            },
            function(a){errorcallback(a); app.STD_END(); f(a);}
        );
    });

    flow_steps.push(function(a, f){
        p.executeSql(pgcon)(
            [pgtabel].concat(pgparam),
            function(ans){
                res.OPT_STATUS = constr.OPT.SUCCESS;
                res.DESCRIPTION = '';
                res.DATA = [];
                for (var i=0; i<ans.length; i++) {
                    var pg = {};
                    pg.PG = ans[i].pg.split('_')[1];
                    if (ans[i].type == 'DVS') {
                        pg.TYPE = '分布式交换机';
                    }
                    else {
                        pg.TYPE = '标准交换机';
                    }
                    pg.DC = ans[i].dc;
                    pg.HOST = ans[i].host;
                    pg.VSWITCH = ans[i].vswitch;
                    pg.LCUUID = ans[i].lcuuid;
                    var vl2id = ans[i].vl2id;
                    var userid = ans[i].userid;
                    if (vl2id in vl2id_to_name) {
                        pg.VL2NAME = vl2id_to_name[vl2id];
                        pg.VL2UUID = vl2id_to_uuid[vl2id];
                    }
                    else {
                        pg.VL2NAME = '';
                        pg.VL2UUID = '';
                    }
                    var user = {};
                    user.ID = userid;
                    if (userid in userid_to_name) {
                        user.NAME = userid_to_name[userid];
                    }
                    else {
                        user.NAME = "--";
                    }
                    pg.USER = user;
                    pg.VL2ID = vl2id;
                    pg.VCNAME = 'vmware-1';
                    res.DATA[i] = pg;
                }
                callback(res);
                f(a);
            },
            function(a){errorcallback(a); app.STD_END(); f(a);}
        );
    });

    app.fire('', function(){});
}

Pack.prototype.patch_portgroup = function(data, callback, errorcallback) {

    var p = this;

    var res = {};
    var sdata = {};
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    sdata.USERID = data.USERID;
    flow_steps.push(function(a, f){
        p.sendData('/v1/pg/'+data.lcuuid, 'patch', sdata,
            function(sCode, rdata) {
                if (sCode == 200) {
                    res.OPT_STATUS = constr.OPT.SUCCESS;
                    res.DESCRIPTION = '';
                    callback(res);
                } else {
                    errorcallback(sCode, {OPT_STATUS: constr.OPT.FAIL, DESCRIPTION: 'fail'});
                }
                f(a);
            },
            function(a) {errorcallback(a); app.STD_END();f(a);}
        );
    });
    app.fire('', function(){});
}


Pack.prototype.get_vms_by_portgroup = function(data, callback, errorcallback) {
    var p = this;

    var res = {};
    var vms = [];
    var sdata = [];
    var vmtabel = 'vm_v2_2';
    var pgtabel = 'portgroup_v2_2';
    var iftabel = 'vinterface_v2_2';
    var vmcon = 'select name,lcuuid from ?? where id in ';
    var pgcon = 'select pg from ?? where lcuuid=?';
    var ifcon = 'select deviceid from ?? where pg_id=?';
    var vmparam = [];
    var pgparam = [];
    var ifparam = [];
    var deviceid = [];
    var flow_steps = [];
    var app = new flow.serial(flow_steps);


    if ('lcuuid' in data) {
        pgparam.push(data.lcuuid);
    }
    else {
        errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL, DESCRIPTION: 'lcuuid is required'});
    }

    flow_steps.push(function(a, f){
        p.executeSql(pgcon)(
            [pgtabel].concat(pgparam),
            function(ans){
                if (ans.length <= 0) {
                    errorcallback(400, {OPT_STATUS: constr.OPT.PARAMETER_ILLEGAL, DESCRIPTION: 'lcuuid is error'});
                    f(a);
                }
                ifparam.push(ans[0].pg);
                f(a);
            },
            function(a){errorcallback(a); app.STD_END(); f(a);}
        );
    });

    flow_steps.push(function(a, f){
        p.executeSql(ifcon)(
            [iftabel].concat(ifparam),
            function(ans){
                if (ans.length == 0) {
                    vmparam.push('-1');
                    f(a);
                }
                for (var i=0; i<ans.length; i++) {
                    deviceid.push(ans[i].deviceid);
                }
                vmparam.push(deviceid.toString());
                f(a);
            },
            function(a){errorcallback(a); app.STD_END(); f(a);}
        );
    });

    flow_steps.push(function(a, f) {
        vmcon = vmcon + '(' + vmparam.toString() + ')';
        p.executeSql(vmcon)(
            [vmtabel],
            function(ans){
                for (var i=0; i<ans.length; i++) {
                    var vm = {};
                    vm.NAME = ans[i].name;
                    vm.LCUUID = ans[i].lcuuid;
                    vms.push(vm);
                }
                if (vms.length == 0) {
                    res.OPT_STATUS = constr.OPT.SUCCESS;
                    res.DESCRIPTION = '';
                    res.DATA = [];
                    callback(res);
                    app.STD_END();
                    f(a);
                }
                else {
                    f(a);
                }
            },
            function(a){errorcallback(a); app.STD_END(); f(a);}
        );
    });

    flow_steps.push(function(a, f) {
        var inner_flow_steps = [];
        for (var idx=0;idx<vms.length;idx++) {
            var url = '/v1/vms/' + vms[idx].LCUUID + '/?pool_type=vmware';
            (function(url){
            inner_flow_steps.push(
                function(a, f){
                    p.sendData(url, 'get', [],
                        function(sCode, rdata) {
                            sdata = sdata.concat(rdata.DATA);
                            f(a);
                        },
                        function() {f(a)}
                    );
                }
            )
            })(url)
        }
        var inner_flow = new flow.parallel(inner_flow_steps);
        inner_flow.fire('', function(){f(a)})
    });

    flow_steps.push(function(a, f) {
        res.OPT_STATUS = constr.OPT.SUCCESS;
        res.DESCRIPTION = '';
        res.DATA = sdata;
        callback(res);
        app.STD_END();
        f(a);
    });

    app.fire('', function(){});
}

Pack.prototype.postPortGroupConnection = function(options, callback){
    var p = this;
    var Q = new flow.Qpack(flow.serial);
    //patch vl2
    Q.setData('startTime', new Date().toMysqlFormat());
    Q.setRejectHandler(callback);
    Q.then(function(placeHolder, onFullfilled){
        onFullfilled({
            'data': options,
            'validator': dataFormat.subnetExternalPost(),
        });
    })
    .then(dataFormat.checkParamsValid())
    .then(api.callTalker('GET', 'v1/subnets/'+options.vl2_lcuuid, '', function(ans){
        Q.setData('vl2Data', ans.body.DATA);
        return {
            TYPE: options.type,
            VMWARE_PORT_GROUP_LCUUID: options.vmware_port_group_lcuuid,
        }
    }))
    .then(api.callTalker('POST', 'v1/subnets/'+options.vl2_lcuuid+'/external-extensions/','', function(){return {lcuuid:options.vmware_port_group_lcuuid}}))
    .then(function(filter, onFullfilled){
        p.get_vms_by_portgroup(filter, function(ans){onFullfilled(ans.DATA)}, function(err){Q.reject(err)})
    });
    //find all vms, patch network & vpcid
    Q.then(function(vms, onFullfilled){
        if (vms.length == 0){
            Q.reject({OPT_STATUS: constr.OPT.SUCCESS})
        }
        logger.info(vms);
        vms.forEach(function(vm){
            //get vm
            var Q2 = new flow.Qpack(flow.serial);
            (function(Q2){
            Q2.then(api.callTalker('GET', 'v1/vms/'+vm.LCUUID, {}, function(data){Q2.setData('vmData', data.body.DATA); return data.body.DATA}))
            //patch vm epcid
            .then(function(data, onFullfilled){
                Vm.prototype.setepc({id:data.ID, epc_id:Q.getData('vl2Data').EPC_ID}, onFullfilled, function(data){Q2.reject(data), onFullfilled})
            })
            .then(function(data, onFullfilled){
                Q2.getData('vmData').INTERFACES.forEach(function(vif){
                    if (('VMWARE_PORT_GROUP_LCUUID' in vif) && (vif.VMWARE_PORT_GROUP_LCUUID==options.vmware_port_group_lcuuid)){
                        Q2.then(Task.prototype.asyncTask('PUT',
                            'v1/vms/'+Q2.getData('vmData').LCUUID+'/interfaces/'+vif.IF_INDEX,
                            {
                                LAN:{
                                    VL2_LCUUID: options.vl2_lcuuid,
                                    IPS: [{VL2_NET_INDEX:1, ADDRESS:'0.0.0.0'}],
                                    QOS: { MIN_BANDWIDTH: 2000, MAX_BANDWIDTH: 2000 }
                                },
                                STATE: 1,
                                IF_TYPE: 'LAN',
                            }
                        ))
                    } else {
                        logger.info('vm'+vm.LCUUID+' if not match vmware pg id');
                    }
                })
                onFullfilled();
            })
            })(Q2)
            Q.then(Q2)
        })
        Q.then(function(data, onFullfilled){
            callback({OPT_STATUS:constr.OPT.SUCCESS});
            onFullfilled();
        })
        onFullfilled();
    })
    return Q;
}

Pack.prototype.delPortGroupConnection = function(options, callback){
    var p = this;
    var Q = new flow.Qpack(flow.serial);
    //patch vl2
    Q.setData('startTime', new Date().toMysqlFormat());
    Q.setRejectHandler(callback);
    Q.then(function(placeHolder, onFullfilled){
        onFullfilled({
            'data': options,
            'validator': dataFormat.subnetExternalDel(),
        });
    })
    .then(dataFormat.checkParamsValid())
    .then(function(data, onFullfilled){
        p.get_vms_by_portgroup({lcuuid: options.vmware_port_group_lcuuid}, function(ans){onFullfilled(ans.DATA)}, function(err){Q.reject(err)})
    });
    //find all vms, patch network & vpcid
    Q.then(function(vms, onFullfilled){
        var Q2 = new flow.Qpack(flow.serial);
        vms.forEach(function(vm){
            //get vm
            Q2.then(api.callTalker('GET', 'v1/vms/'+vm.LCUUID, {}, function(data){return data.body.DATA}))
            .then(function(vmInfo, onFullfilled){
                logger.info(vmInfo);
                vmInfo.INTERFACES.forEach(function(vif){
                    if ('VMWARE_PORT_GROUP_LCUUID' in vif && vif.VMWARE_PORT_GROUP_LCUUID==options.vmware_port_group_lcuuid){
                        Q2.then(api.callTalker('PUT',
                            'v1/vms/'+vm.LCUUID+'/interfaces/'+vif.IF_INDEX,
                            {STATE: 2}
                        ))
                    }
                })
                Q2.then(function(data, onFullfilled){
                    Vm.prototype.setepc({id:vmInfo.ID, epc_id:0}, onFullfilled, function(err){Q2.reject(err)})
                })
                onFullfilled();
            })
            //patch vm epcid
        })
        Q.then(Q2)
        .then(api.callTalker('DEL', 'v1/subnets/'+options.vl2_lcuuid+'/external-extensions/'+options.vmware_port_group_lcuuid, {}, function(ans){callback(ans.code,ans.body)}));
        onFullfilled();
    })
    return Q;
}


module.exports = Pack;
