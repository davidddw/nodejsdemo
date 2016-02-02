var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Isp = require('./isp.js');
var atry = require('./mydomain.js')
var constr = require('./const.js');
var balance = require('./balance.js');
var Epc = require('./epc.js');
var lc_utils = require('./lc_utils.js');
var Cashier = require('./cashier.js');
var uuid = require('node-uuid');
var Order_Charge = function() {Obj.call(this);}

util.inherits(Order_Charge, Obj);

Order_Charge.prototype.order_tableName = 'order_v2_2';
Order_Charge.prototype.fdb_vm_tableName = 'fdb_vm_v2_2';
Order_Charge.prototype.fdb_user_tableName = 'fdb_user_v2_2';
Order_Charge.prototype.fdb_vgw_tableName = 'fdb_vgateway_v2_2';
Order_Charge.prototype.vnet_tableName = 'vnet_v2_2';
Order_Charge.prototype.ip_resource_tableName = 'ip_resource_v2_2';
Order_Charge.prototype.user_order_ip_bw_tableName = 'user_order_isp_bandwidth_v2_2';
Order_Charge.prototype.vl2_tableName = 'vl2_v2_2';
Order_Charge.prototype.tpd_tableName = 'third_party_device_v2_2';
Order_Charge.prototype.ps_tableName = 'product_specification_v2_2';
Order_Charge.prototype.vm_snapshot_tableName = 'vm_snapshot_v2_2';
Order_Charge.prototype.vul_tableName = 'vul_scanner_v2_2';
Order_Charge.prototype.nas_tableName = 'nas_storage_v2_2';
Order_Charge.prototype.back_tableName = 'backup_space_v2_2';

Order_Charge.prototype.type = {
    VM : 1,
    VFW : 15,
    VGATEWAY: 2,
    VALVE: 17,
    THIRDHW: 9,
    IP: 5,
    BANDW: 6,
    LOAD_BALANCER: 11,
    SNAPSHOT: 12,
    WEB_VUL_SCANNER: 8,
    SYS_VUL_SCANNER: 7,
    NAS: 4
};

Order_Charge.prototype.instance_type = {
    VM : 1,
    VFW : 7,
    VGATEWAY: 2,
    VALVE: 9,
    THIRDHW: 5,
    IP: 3,
    BANDW: 4,
    LOAD_BALANCER: 6
};

Order_Charge.prototype.get = function(data, callback, errorcallback) {
    var i, j;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var p = this;
    var response = {OPT_STATUS: constr.OPT.SUCCESS, data:{}};
    var userid,order_id,shopping_list;
    data.OPT_STATUS = constr.OPT.SUCCESS;
    if('id' in data){
        order_id = data.id;
    }else if('order_id' in data){
        order_id = data.order_id
    }else{
        errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get order_id is not specified'});
        return;
    }
    if('detail' in data){
        shopping_list = JSON.parse(data.detail);
    }else{
        errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get detail is not specified'});
        return;
    }
    response.data.ORDER_ID = parseInt(order_id);
    response.data.DOMAIN = data.domain;
    response.data.USERID = data.userid;

    function getSession(userid, callback, errorcallback){
        var condition = 'select session,useruuid from ?? where ??=?';
        p.executeSql(condition)([Order_Charge.prototype.fdb_user_tableName, 'id', userid],function(ans){
            if (ans != null && ans.length > 0){
                if (ans[0].session != '0'){
                    callback(ans);
                    return;
                } else{
                    p.executeSql(condition)([Order_Charge.prototype.fdb_user_tableName, 'id', 1],function(admin){
                        if (admin != null && admin.length > 0) {
                            admin[0].useruuid = ans[0].useruuid;
                            callback(admin);
                            return;
                        }
                   },errorcallback);
                }
            }
        }, errorcallback);
    }

    flow_steps.push(function(a, f) {
        getSession(data.userid, function(ans){
            response.session = ans[0].session;
            response.data.USERUUID = ans[0].useruuid;
            f(a);
        },function(a){errorcallback(a), app.STD_END()});
    });

    flow_steps.push(function(a, f) {
        if(('vm' in shopping_list && shopping_list.vm != null && shopping_list.vm.length > 0) ||
                ('VMS' in shopping_list && shopping_list.VMS != null && shopping_list.VMS.length > 0) ){
            var condition = 'select lcuuid as INSTANCE_LCUUID,name as NAME,product_specification_lcuuid as PS_LCUUID,vcpu_num as CPU,mem_size as MEMORY,user_disk_size as DISK ';
            condition += 'from ?? where ??=? and state=4 and role=1';
            logger.info("condition: ", condition);
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.fdb_vm_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    if('vm' in shopping_list && shopping_list.vm != null && shopping_list.vm.length > 0 && typeof shopping_list.vm[0] == 'string'){
                        ans[0].MDF_FLAG = true;
                    }
                    response.data.VMS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(('vfw' in shopping_list && shopping_list.vfw != null && shopping_list.vfw.length > 0) ||
                ('VFWS' in shopping_list && shopping_list.VFWS != null && shopping_list.VFWS.length > 0) ){
            var condition = 'select lcuuid as INSTANCE_LCUUID,name as NAME,product_specification_lcuuid as PS_LCUUID from ?? where ??=? and state=4 and role=6';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.fdb_vm_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.VFWS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(('vgw' in shopping_list && shopping_list.vgw != null && shopping_list.vgw.length > 0) ||
                ('VGWS' in shopping_list && shopping_list.VGWS != null && shopping_list.VGWS.length > 0) ){
            var condition = 'select lcuuid as INSTANCE_LCUUID,name as NAME,product_specification_lcuuid as PS_LCUUID from ?? where ??=? and state=7 and role=7';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.fdb_vgw_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.VGWS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(('bwt' in shopping_list && shopping_list.bwt != null && shopping_list.bwt.length > 0) ||
                ('BWTS' in shopping_list && shopping_list.BWTS != null && shopping_list.BWTS.length > 0) ){
            var condition = 'select vgw.lcuuid as INSTANCE_LCUUID,vgw.name as NAME,vgw.product_specification_lcuuid as PS_LCUUID from ?? vgw, ?? ';
            condition += 'net where vgw.lcuuid = net.lcuuid and ??=? and net.role = 11 and vgw.state=7';
            var param = [];
            param.push('vgw.order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.fdb_vgw_tableName,Order_Charge.prototype.vnet_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.BWTS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(('thirdparty' in shopping_list && shopping_list.thirdparty != null && shopping_list.thirdparty.length > 0) ||
                ('THIRDPARTYS' in shopping_list && shopping_list.THIRDPARTYS != null && shopping_list.THIRDPARTYS.length > 0) ){
            var condition = 'select lcuuid as INSTANCE_LCUUID,name as NAME,product_specification_lcuuid as PS_LCUUID from ?? where ??=? and state=1';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.tpd_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.THIRDPARTYS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(('ip' in shopping_list && shopping_list.ip != null && shopping_list.ip.length > 0) ||
                ('IPS' in shopping_list && shopping_list.IPS != null && shopping_list.IPS.length > 0) ){
            var condition = 'select ip.lcuuid as INSTANCE_LCUUID, concat(vl2.name, \' \', ip.ip) as NAME, ip.product_specification_lcuuid as PS_LCUUID ';
            condition += 'from ?? ip,?? vl2 where ip.isp = vl2.isp and ip.alloc_tag is not null and ??=?';
            var param = [];
            param.push('ip.order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.ip_resource_tableName,Order_Charge.prototype.vl2_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.IPS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    /* get all ISP name, including general bandwidth ISP */
    flow_steps.push(function(a, f) {
        p.sendData('/v1/isps', 'get', {},
            function(code, resp) {
                data.ISPS = resp.DATA;
                f(a);
            },
            function(code, resp) {
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });
    flow_steps.push(function(a, f) {
        p.sendData('/v1/isps/0', 'get', {domain: data.domain},
            function(code, resp) {
                data.ISPS.push(resp.DATA);
                f(a);
            },
            function(code, resp) {
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });

    flow_steps.push(function(a, f) {
        response.data.BWS = [];
        if(('bandwidth' in shopping_list && shopping_list.bandwidth != null && shopping_list.bandwidth.length > 0) ||
                ('BANDWIDTHS' in shopping_list && shopping_list.BANDWIDTHS != null && shopping_list.BANDWIDTHS.length > 0) ){
            var condition = 'select bw.lcuuid, bw.isp ';
            condition += 'from ?? bw where ??=?';
            var param = [Order_Charge.prototype.user_order_ip_bw_tableName];
            param.push('bw.order_id');
            param.push(order_id);
            p.executeSql(condition)(param, function(ans) {
                if (ans == null || ans.length == 0) {
                    logger.info('can not find bandwidth order in', order_id);
                    f(a);
                    return;
                }
                var inner_flow_steps = [];
                var inner_app = new flow.serial(inner_flow_steps);
                for (ib = 0; ib < ans.length; ++ib) {
                    (function(ib){
                        inner_flow_steps.push(function(a, f) {
                            p.charge_bandwidth_order({lcuuid: ans[ib].lcuuid}, function(resp){
                                if (resp.OPT_STATUS == 'SUCCESS'){
                                    var isp_name = 'Unknown ISP';
                                    var megabytes = parseInt(resp.DATA.BANDWIDTH_TOTAL.BANDWIDTH) >> 20;
                                    for (is = 0; is < data.ISPS.length; ++is) {
                                        if (data.ISPS[is].ISP == ans[ib].isp) {
                                            isp_name = data.ISPS[is].NAME;
                                        }
                                    }
                                    response.data.BWS.push({
                                        INSTANCE_LCUUID: resp.DATA.BANDWIDTH_TOTAL.LCUUID,
                                        NAME: isp_name + ' ' + megabytes + 'M',
                                        PS_LCUUID: resp.DATA.BANDWIDTH_TOTAL.PRODUCT_SPECIFICATION_LCUUID,
                                        SIZE: megabytes,
                                        MDF_FLAG: true,
                                    });
                                    f(a);
                                } else {
                                    logger.error('failed to deliver bandwidth order', ans[ib].INSTANCE_LCUUID);
                                    errorcallback(resp);
                                    inner_app.STD_END();
                                    app.STD_END();
                                }
                            });
                        });
                    })(ib);
                }
                inner_app.fire('', function() {
                    logger.info('all bandwidth in order', order_id, 'delivered: ', response.data.BWS);
                    f(a);
                });
            }, function(a){errorcallback(a), app.STD_END()});
        } else {
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        if(('lbs' in shopping_list && shopping_list.lbs != null && shopping_list.lbs.length > 0) ||
                ('LBS' in shopping_list && shopping_list.LBS != null && shopping_list.LBS.length > 0) ){
            var condition = 'select lcuuid as INSTANCE_LCUUID,name as NAME,product_specification_lcuuid as PS_LCUUID from ?? where ??=? and state=4 and role=2';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.fdb_vm_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.LBS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        /* FIXME: lbs ? SNAPSHOTS ? */
        if(('lbs' in shopping_list && shopping_list.lbs != null && shopping_list.lbs.length > 0) ||
                ('SNAPSHOTS' in shopping_list && shopping_list.SNAPSHOTS != null && shopping_list.SNAPSHOTS.length > 0) ){
            var condition = 'select vm.name as NAME,vm.lcuuid as INSTANCE_LCUUID,ps.lcuuid as PS_LCUUID,snapshot.lcuuid as OBJ_LCUUID '
                condition += 'from ?? vm,?? ps,?? snapshot WHERE vm.domain = ps.domain and vm.lcuuid = snapshot.vm_lcuuid and ps.product_type = 11';
            var param = [];
            param.push('vm.order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.fdb_vm_tableName,Order_Charge.prototype.ps_tableName,Order_Charge.prototype.vm_snapshot_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.SNAPSHOTS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        //web scan
        if(('webscan' in shopping_list && shopping_list.webscan != null && shopping_list.webscan.length > 0) ||
                ('SCANNERS' in shopping_list && shopping_list.SCANNERS != null && shopping_list.SCANNERS.length > 0) ){
            var condition = 'select scan_target as NAME,product_specification_lcuuid as PS_LCUUID,lcuuid as OBJ_LCUUID from ?? where scan_target is not null and ??=?';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.vul_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.WEBSCANS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });

    flow_steps.push(function(a, f) {
        //sys scan
        if(('sysscan' in shopping_list && shopping_list.sysscan != null && shopping_list.sysscan.length > 0) ||
                ('SCANNERS' in shopping_list && shopping_list.SCANNERS != null && shopping_list.SCANNERS.length > 0) ){
            var condition = 'select vm.name as NAME,vul.product_specification_lcuuid as PS_LCUUID,vul.lcuuid as OBJ_LCUUID from ?? vul,?? vm where vul.vm_lcuuid = vm.lcuuid and ??=? ';
            var param = [];
            param.push('vul.order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.vul_tableName,Order_Charge.prototype.fdb_vm_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.SYSSCANS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });
    flow_steps.push(function(a, f) {
        if(('storage' in shopping_list && shopping_list.storage != null && shopping_list.storage.length > 0) ||
                ('storage_mdf' in shopping_list && shopping_list.storage_mdf != null && shopping_list.storage_mdf.length > 0) ||
                ('NAS' in shopping_list && shopping_list.NAS != null && shopping_list.NAS.length > 0) ){
            var condition = 'select name as NAME,product_specification_lcuuid as PS_LCUUID,lcuuid as OBJ_LCUUID,total_size as SIZE from ?? where ??=? and path is not null and path <> \'\'';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.nas_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    if('storage_mdf' in shopping_list && shopping_list.storage_mdf != null && shopping_list.storage_mdf.length > 0){
                        ans[0].MDF_FLAG = true;
                    }
                    response.data.NAS = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });
    flow_steps.push(function(a, f) {
        if(('backup' in shopping_list && shopping_list.backup != null && shopping_list.backup.length > 0) ||
                ('BACKUP' in shopping_list && shopping_list.BACKUP != null && shopping_list.BACKUP.length > 0) ){
            var condition = 'select \'BACKUP\' as NAME,product_specification_lcuuid as PS_LCUUID,lcuuid as OBJ_LCUUID,total_size as SIZE from ?? where ??=? ';
            var param = [];
            param.push('order_id');
            param.push(order_id);
            p.executeSql(condition)([Order_Charge.prototype.back_tableName].concat(param),function(ans){
                if (ans != null && ans.length > 0) {
                    response.data.BACKUP = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()});
        }else{
            f(a);
        }
    });
    app.fire('',function() {logger.info('get order charge info by ', order_id , ' finished.',response.data);response.data = JSON.stringify(response.data);callback(response)});
}


Order_Charge.prototype.charge_bandwidth_order = function(data, callback, errorcallback){
    var p = this;
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var cashier_data = {};

    /* deliver bandwidth order */

    flow_steps.push(function(a, f){
        p.sendData('/v1/bandwidth-orders/' + data.lcuuid, 'patch', {STATE: 'DELIVERED'},
            function(code, resp) {
                data.USERID = resp.DATA.USERID;
                data.ISP = resp.DATA.ISP;
                logger.debug('deliver bandwidth order', data.lcuuid, 'success');
                f(a);
            },
            function(code, resp) {
                logger.error('deliver bandwidth order', data.lcuuid, 'failed:', code, resp);
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });


    /* get total delivered bandwidth */
    flow_steps.push(function(a, f){
        p.sendData('/v1/bandwidths', 'get',
            {
                'userid': data.USERID,
                'isp': data.ISP,
            },
            function(code, resp) {
                if (resp.DATA.length == 1) {
                    data.bandwidth_total = resp.DATA[0];
                    logger.info("data.bandwidth_total: ", data.bandwidth_total);
                    callback({OPT_STATUS: 'SUCCESS', DESCRIPTION: '', DATA: {BANDWIDTH_TOTAL: data.bandwidth_total}});
                    f(a);
                } else {
                    errorcallback(404, {
                        OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,
                        DESCRIPTION: "no user_isp_bandwidth after bandwidth order delivered"
                    });
                    app.STD_END();
                }
            },
            function(code, resp) {
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });

    app.fire('',
             function() {
                 logger.info('deliver & charge bandwidth order', data.lcuuid, 'complete');
             });
}

module.exports = Order_Charge;
