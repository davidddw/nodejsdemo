var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var Vm = require('./vm.js');
var Epc = require('./epc.js');
var Isp = require('./isp.js');
var operationLog = require('./operation_log.js');
var constr = require('./const.js');
var balance = require('./balance.js');
var order_charge = require('./order_charge.js');
var Vm_Snapshot = require('./vm_snapshot.js');

var Solution = function(){
    Obj.call(this);
};
util.inherits(Solution, Obj);
Solution.prototype.type = 'solutions';
Solution.prototype.constructor = Solution;

const WAN_IF = 'WAN';
const LAN_IF = 'LAN';
const VIF_STATE_ATTACHED = 1;
const SUBNET_PREFIX = '10.10.';
const VM_PATCH_VIF_ACTION = 'modifyinterface'
const INSTANCE_TYPE_VM = 1;
const INSTANCE_TYPE_VGATEWAY = 5;
const VIF_IFINDEX_VGATEWAY_LAN = 10;

function check_instance_vif(balance_check_data, instance,solution_name) {
    var j, k;
    for (j = 0; j < instance.INTERFACES.length; ++j) {
        var vif = instance.INTERFACES[j];
        if (!(WAN_IF in vif)) {
            /* nothing to do */
            continue;
        }
        for (k = 0; k < balance_check_data.IPS.length; ++k) {
            if (balance_check_data.IPS[k].ISP == vif.WAN.ISP) {
                if (balance_check_data.IPS[k].PRODUCT_SPECIFICATION_LCUUID !=
                    vif.WAN.IP_PRODUCT_SPECIFICATION_LCUUID) {
                    /* never happen */
                    logger.error(
                        'Solution', solution_name,
                        'create continue but we found ISP', vif.WAN.ISP,
                        'have two IP product specifications.');
                }
                balance_check_data.IPS[k].IP_NUM += parseInt(vif.WAN.IP_NUM);
                break;
            }
        }
        if (k >= balance_check_data.IPS.length) {
            balance_check_data.IPS.push({
                ISP: vif.WAN.ISP,
                IP_NUM: parseInt(vif.WAN.IP_NUM),
                PRODUCT_SPECIFICATION_LCUUID: vif.WAN.IP_PRODUCT_SPECIFICATION_LCUUID,
                DOMAIN:balance_check_data.DOMAIN
            });
        }
        for (k = 0; k < balance_check_data.BANDWIDTHS.length; ++k) {
            if (balance_check_data.BANDWIDTHS[k].ISP == vif.WAN.ISP) {
                if (balance_check_data.IPS[k].PRODUCT_SPECIFICATION_LCUUID !=
                    vif.WAN.QOS.PRODUCT_SPECIFICATION_LCUUID) {
                    /* never happen */
                    logger.info(
                        'Solution', solution_name,
                        'create continue but we found ISP', vif.WAN.ISP,
                        'have two bandwidth product specifications.');
                }
                balance_check_data.BANDWIDTHS[k].BANDWIDTH += vif.WAN.QOS.BANDWIDTH;
                break;
            }
        }
        if (k >= balance_check_data.BANDWIDTHS.length) {
            balance_check_data.BANDWIDTHS.push({
                ISP: vif.WAN.ISP,
                BANDWIDTH: vif.WAN.QOS.BANDWIDTH,
                PRODUCT_SPECIFICATION_LCUUID: vif.WAN.QOS.PRODUCT_SPECIFICATION_LCUUID,
                DOMAIN:balance_check_data.DOMAIN
            });
        }
    }
}

function create_instance_isp_ip(flow_steps, isp_obj, data, instance) {
    var j, k;
    for (j = 0; j < instance.INTERFACES.length; ++j) {
        var vif = instance.INTERFACES[j];
        if (!(WAN_IF in vif)) {
            /* nothing to do */
            continue;
        }

        vif.WAN.IPS = [];
        for (k = 0; k < vif.WAN.IP_NUM; ++k) {
            vif.WAN.IPS.push({});
            var isp_create = {
                operator_name: data.operator_name,
                userid: data.USERID,
                order_id: data.ORDER_ID,
                isp: vif.WAN.ISP,
                domain:data.DOMAIN
            };
            (function(instance, isp_create, wan_ip) {
                flow_steps.push(function(a, f) {
                    isp_obj.user_ip_resources(isp_create,
                        function(resp){
                            if (arguments.length == 1 && 'DATA' in resp && 'IP_RESOURCE_LCUUID' in resp.DATA) {
                                wan_ip.LCUUID = resp.DATA.IP_RESOURCE_LCUUID;
                                if (!('GATEWAY' in instance)) {
                                    // first IP's gateway as VM's default gateway
                                    instance.GATEWAY = resp.DATA.GATEWAY;
                                }
                            } else {
                                data.OPT_STATUS = constr.OPT.FAIL;
                            }
                            logger.info(
                                'Solution', data.NAME,
                                'create continue since IP in ISP', isp_create.isp,
                                'create finished:', arguments);
                            f(a);
                        },
                        function() {
                            data.OPT_STATUS = constr.OPT.FAIL;
                            logger.error(
                                'Solution', data.NAME,
                                'create continue but IP in ISP', isp_create.isp,
                                'create failed:', arguments);
                            f(a);
                        }
                    );
                });
            })(instance, isp_create, vif.WAN.IPS[k]);
        }
    }
}

function get_vif_attach_array(data, instance_type, instance) {
    var j, k;
    var vif_attach = [];
    var if_index = 0;
    var wan_index = 1, lan_index = VIF_IFINDEX_VGATEWAY_LAN;
    for (j = 0; j < instance.INTERFACES.length; ++j) {
        var vif = instance.INTERFACES[j];
        if (WAN_IF in vif) {
            var ip_attach = [];
            for (k = 0; k < vif.WAN.IPS.length; ++k) {
                if ('LCUUID' in vif.WAN.IPS[k]) {
                    ip_attach.push({
                        ip_resource_lcuuid: vif.WAN.IPS[k].LCUUID,
                    });
                }
            }
            if (ip_attach.length == 0) {
                logger.error(
                    'Solution', data.NAME, 'create continue but vif attach of', instance.NAME,
                    'is ignored since vif', j, 'has no IP:', vif.WAN.IPS);
                continue;
            }

            if (instance_type == INSTANCE_TYPE_VGATEWAY) {
                if_index = wan_index++;
            } else {
                if_index = j;
            }
            vif_attach.push({
                state: VIF_STATE_ATTACHED,
                if_index: if_index,
                if_type: WAN_IF,
                wan: {
                    ips: ip_attach,
                    qos: {
                        min_bandwidth: vif.WAN.QOS.BANDWIDTH,
                        max_bandwidth: vif.WAN.QOS.BANDWIDTH,
                    },
                },
            });

        } else if (LAN_IF in vif) {
            for (k = 0; k < data.VL2S.length; ++k) {
                if (vif.LAN.VL2_NAME == data.VL2S[k].NAME) {
                    break;
                }
            }
            if (k >= data.VL2S.length) {
                logger.error(
                    'Solution', data.NAME, 'create continue but vif attach of', instance.NAME,
                    'is ignored since vl2', vif.LAN.VL2_NAME, 'create failed.');
                continue;
            }

            if (instance_type == INSTANCE_TYPE_VGATEWAY) {
                if_index = lan_index++;
            } else {
                if (!('GATEWAY' in instance) && instance_type == INSTANCE_TYPE_VM) {
                    instance.GATEWAY = SUBNET_PREFIX + data.VL2S[k].PREFIX_ID + '.1';
                }
                if_index = j;
            }
            vif_attach.push({
                state: VIF_STATE_ATTACHED,
                if_index: if_index,
                if_type: LAN_IF,
                lan: {
                    vl2_lcuuid: data.VL2S[k].LCUUID,
                    ips: [{
                        vl2_net_index: 1,
                        address: SUBNET_PREFIX + data.VL2S[k].PREFIX_ID + '.' + data.VL2S[k].IP_OFFSET,
                    }],
                    qos: {
                        min_bandwidth: 0,
                        max_bandwidth: 0
                    }
                },
            });
            data.VL2S[k].IP_OFFSET += 1;
        }
    }

    return vif_attach;
}

function check_balance(data, flow_steps, app, standard_action, callback, errorcallback) {
    var balance_check_data = {
        ORDER_ID: data.ORDER_ID,
        USERID: data.USERID,
        CHARGE_DAYS: data.CHARGE_DAYS,
        DOMAIN:data.DOMAIN,
        VMS: [],
        LBS: [],
        VGWS: [],
        IPS: [],
        BANDWIDTHS: [],
    }
    for (i = 0; i < data.VMS.length; ++i) {
        for (j = 0; j < balance_check_data.VMS.length; ++j) {
            if (balance_check_data.VMS[j].PRODUCT_SPECIFICATION_LCUUID ==
                data.VMS[i].PRODUCT_SPECIFICATION_LCUUID) {
                balance_check_data.VMS[j].NUM += 1;
                break;
            }
        }
        if (j >= balance_check_data.VMS.length) {
            balance_check_data.VMS.push({
                NUM: 1,
                PRODUCT_SPECIFICATION_LCUUID: data.VMS[i].PRODUCT_SPECIFICATION_LCUUID,
                VCPU_NUM:data.VMS[i].VCPU_NUM,
                MEM_SIZE:data.VMS[i].MEM_SIZE,
                USER_DISK_SIZE:data.VMS[i].SYS_DISK_SIZE,
                DOMAIN:data.DOMAIN
            })
        }
        check_instance_vif(balance_check_data, data.VMS[i],data.NAME);
    }
    for (i = 0; i < data.VGATEWAYS.length; ++i) {
        for (j = 0; j < balance_check_data.VGWS.length; ++j) {
            if (balance_check_data.VGWS[j].PRODUCT_SPECIFICATION_LCUUID ==
                data.VGATEWAYS[i].PRODUCT_SPECIFICATION_LCUUID) {
                balance_check_data.VGWS[j].NUM += 1;
                break;
            }
        }
        if (j >= balance_check_data.VGWS.length) {
            balance_check_data.VGWS.push({
                NUM: 1,
                PRODUCT_SPECIFICATION_LCUUID: data.VGATEWAYS[i].PRODUCT_SPECIFICATION_LCUUID,
                DOMAIN:data.DOMAIN
            })
        }
        check_instance_vif(balance_check_data, data.VGATEWAYS[i],data.NAME);
    }
    data.QOS_DEMAND = balance_check_data.BANDWIDTHS;
//    flow_steps.push(function(a, f) {
//        var b = new balance();
//        b.checkBalance(app, balance_check_data, function(flag){f(flag)}, errorcallback);
//    })
    flow_steps.push(function(flag, f) {
        flag = true;
        if(flag){
            logger.info('Solution', data.NAME,
                'create continue since balance check passed:', data);
        } else {
            logger.error('Solution', data.NAME,
                'create will terminate since balance check failed:', arguments);
            callback({ OPT_STATUS: constr.OPT.INSUFFICIENT_BALANCE });
            app.STD_END();
        }
        f(flag);
    })
}

function create_solution(data, flow_steps, app,
        standard_create, standard_action, callback, errorcallback) {
    var i, j;
    var epc_obj = new Epc();
    var isp_obj = new Isp();
    var vm_obj = new Vm();

    /* STEP 1: create epc */
    flow_steps.push(function(a, f) {
        var epc_create = {
            operator_name: data.operator_name,
            userid: data.USERID,
            name: data.NAME,
            domain: data.DOMAIN,
            order_id: data.ORDER_ID
        };
        epc_obj.create(epc_create,
            function(resp){
                if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA) {
                    data.EPC_ID = resp.DATA.ID;
                    operationLog.create({
                        operation:'create', objecttype:'epc', objectid:data.EPC_ID,
                        object_userid:data.userid, operator_name:data.operator_name});
                    logger.info(
                        'Solution', data.NAME,
                        'create continue since EPC create finished:', resp);
                    callback({
                        OPT_STATUS: constr.OPT.SUCCESS,
                        DATA: { NAME: data.NAME, EPC_ID: data.EPC_ID },
                    });
                    f(a);
                } else {
                    data.OPT_STATUS = constr.OPT.FAIL;
                    operationLog.create_and_update({
                        operation:'create', objecttype:'epc', objectid:0,
                        object_userid:data.USERID, operator_name:data.operator_name,
                        opt_result:2, error_code:'SERVICE_EXCEPTION'
                    }, function(){}, function(){});
                    logger.error(
                        'Solution', data.NAME,
                        'create finished since EPC create failed:', arguments);
                    var err_resp = Array.prototype.splice.call(arguments, 0);
                    errorcallback.apply(this, err_resp);
                    app.STD_END();
                }
            },
            function() {
                data.OPT_STATUS = constr.OPT.FAIL;
                operationLog.create_and_update({
                    operation:'create', objecttype:'epc', objectid:data.id,
                    object_userid:data.USERID, operator_name:data.operator_name,
                    opt_result:2, error_code:'SERVICE_EXCEPTION'
                }, function(){}, function(){});
                logger.error(
                    'Solution', data.NAME,
                    'create finished since EPC create failed:', arguments);
                var err_resp = Array.prototype.splice.call(arguments, 0);
                errorcallback.apply(this, err_resp);
                app.STD_END();
            }
        );
    });

    /* STEP 2: create vl2s */
    for (i = 0; i < data.VL2S.length; ++i) {
        var vl2 = data.VL2S[i];
        vl2.PREFIX_ID = i;
        vl2.IP_OFFSET = 1;

        (function(vl2){
            flow_steps.push(function(a, f) {
                var vl2_create = {
                    name: vl2.NAME,
                    vlantag: 0,
                    userid: data.USERID,
                    epc_id: data.EPC_ID,
                    domain: data.DOMAIN,
                    nets: [
                        {
                            prefix: SUBNET_PREFIX + vl2.PREFIX_ID + '.0',
                            netmask: 24,
                        }
                    ]
                };
                standard_create('vl2', vl2_create, function(resp) {
                    if (arguments.length == 1 && 'DATA' in resp && 'LCUUID' in resp.DATA) {
                        vl2.LCUUID = resp.DATA.LCUUID;
                    } else {
                        data.OPT_STATUS = constr.OPT.FAIL;
                    }
                    logger.info(
                        'Solution', data.NAME, 'create continue since VL2', vl2.NAME,
                        'create returned:', arguments);
                })('', function(a){
                    if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                        data.OPT_STATUS = constr.OPT.FAIL;
                    }
                    logger.info(
                        'Solution', data.NAME, 'create continue since VL2', vl2.NAME,
                        'create finish.');
                    f(a);
                });
            });
        })(vl2);
    }

    /* STEP 3: create vgateways */
    for (i = 0; i < data.VGATEWAYS.length; ++i) {
        var vgateway = data.VGATEWAYS[i];
        (function(vgateway){
            flow_steps.push(function(a, f) {
                logger.info('create VGATEWAY started');
                var vgateway_create = {
                    operator_name: data.operator_name,
                    domain: data.DOMAIN,
                    allocation_type: 'AUTO',
                    userid: data.USERID,
                    epc_id: data.EPC_ID,
                    order_id: data.ORDER_ID,
                    name: vgateway.NAME,
                    product_specification_lcuuid: vgateway.PRODUCT_SPECIFICATION_LCUUID
                };
                standard_create('vgateway', vgateway_create, function(resp) {
                    if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA) {
                        vgateway.ID = resp.DATA.ID;
                    } else {
                        data.OPT_STATUS = constr.OPT.FAIL;
                    }
                    logger.info(
                        'Solution', data.NAME, 'create continue since VGATEWAY', vgateway.NAME,
                        'create returned:', arguments);
                })('', function(a){
                    if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                        data.OPT_STATUS = constr.OPT.FAIL;
                    }
                    logger.info(
                        'Solution', data.NAME, 'create continue since VGATEWAY', vgateway.NAME,
                        'create finished.');
                    f(a);
                });
            });
        })(vgateway);

        create_instance_isp_ip(flow_steps, isp_obj, data, vgateway);
    }

    /* STEP 4: create vms */
    var vm_create_steps;
    for (i = 0; i < data.VMS.length; ++i) {
        if (i % constr.MAX_VM_CONCURRENCY == 0){
            vm_create_steps = [];
            flow_steps.push(vm_create_steps);
        }
        var vm = data.VMS[i];

        (function(vm){
            vm_create_steps.push(function(a, f) {
                var vm_create = {
                    type: 'vm',
                    allocation_type: 'auto',
                    userid: data.USERID,
                    epc_id: data.EPC_ID,
                    order_id: data.ORDER_ID,
                    passwd: vm.PASSWD,
                    name: vm.NAME,
                    os: vm.OS,
                    product_specification_lcuuid: vm.PRODUCT_SPECIFICATION_LCUUID,
                    role: vm.ROLE,
                    vcpu_num: vm.VCPU_NUM,
                    mem_size: vm.MEM_SIZE,
                    sys_disk_size : vm.SYS_DISK_SIZE,
                    user_disk_size:vm.USER_DISK_SIZE,
                    domain:data.DOMAIN,
                    operator_name: data.operator_name
                };
                standard_create('vm', vm_create, function(resp) {
                    if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA && 'ERRNO' in resp.DATA && resp.DATA.ERRNO == 0) {
                        vm.ID = resp.DATA.ID;
                        vm.LCUUID = resp.DATA.LCUUID
                    } else {
                        data.OPT_STATUS = constr.OPT.FAIL;
                    }
                    logger.info(
                        'Solution', data.NAME, 'create continue since VM', vm.NAME,
                        'create returned:', arguments);
                })('', function(a){
                    vm.STATE = a.data.state;
                    if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                        data.OPT_STATUS = constr.OPT.FAIL;
                    }
                    logger.info(
                        'Solution', data.NAME, 'create continue since VM', vm.NAME,
                        'create finished.');
                    f(a);
                });
            });
        })(vm);

        create_instance_isp_ip(flow_steps, isp_obj, data, vm);
    }

    /* STEP 5: create bandwidth */
    flow_steps.push(function(a, f) {
        var inner_flow_steps = [];
        var inner_app = new flow.serial(inner_flow_steps);
        var i, j;
        for (i = 0; i < data.QOS_DEMAND.length; ++i) {
            var bw_create = {
                operator_name: data.operator_name,
                USERID: data.USERID,
                ORDER_ID: data.ORDER_ID,
                ISP: data.QOS_DEMAND[i].ISP,
                BANDWIDTH: data.QOS_DEMAND[i].BANDWIDTH,
                PRODUCT_SPECIFICATION_LCUUID: data.QOS_DEMAND[i].PRODUCT_SPECIFICATION_LCUUID,
                DOMAIN:data.DOMAIN
            };
            (function(bw_create) {
                inner_flow_steps.push(function(a, f) {
                    isp_obj.user_order_isp_bandwidths(bw_create,
                        function(){
                            if (arguments.length != 1) {
                                data.OPT_STATUS = constr.OPT.FAIL;
                            }
                            logger.info(
                                'Solution', data.NAME, 'create continue since', bw_create.BANDWIDTH,
                                'Bit', bw_create.PRODUCT_SPECIFICATION_LCUUID,
                                'bandwidth of ISP', bw_create.ISP, 'create finished:', arguments);
                            f(a);
                        },
                        function() {
                            data.OPT_STATUS = constr.OPT.FAIL;
                            logger.error(
                                'Solution', data.NAME, 'create continue since', bw_create.BANDWIDTH,
                                'Bit', bw_create.PRODUCT_SPECIFICATION_LCUUID,
                                'bandwidth of ISP', bw_create.ISP, 'create failed:', arguments);
                            f(a);
                        }
                    );
                });
            })(bw_create);
        }

        inner_app.fire('', function(){
            logger.info(
                'Solution', data.NAME,
                'create continue since all user bandwidth create finished.');
            f(a);
        });
    });

    /* STEP 6: attach vif */
    /* attach vgateway first so they get a 10.10.x.1 subnet IP */
    for (i = 0; i < data.VGATEWAYS.length; ++i) {
        (function(vgateway) {
            flow_steps.push(function(a, f) {
                if (!('ID' in vgateway)) {
                    logger.error(
                        'Solution', data.NAME, 'create continue but vif attach is ignored',
                        'since VGATEWAY', vgateway.NAME, 'create failed.');
                    f(a);
                    return;
                }

                var vgateway_vif_attach = {
                    operator_name: data.operator_name,
                    id: vgateway.ID,
                    data: get_vif_attach_array(data, INSTANCE_TYPE_VGATEWAY, vgateway),
                }
                logger.info(
                    'Solution', data.NAME,
                    'create continue and will attach vif to vgateway', vgateway.NAME,
                    ':', vgateway_vif_attach.data);
                standard_action('update')('vgateway', vgateway_vif_attach, function() {
                    logger.info(
                        'Solution', data.NAME,
                        'create continue since vif attach of VGATEWAY', vgateway.NAME,
                        'returned:', arguments);
                })('', function(a){
                    logger.info(
                        'Solution', data.NAME,
                        'create continue since vif attach of VGATEWAY', vgateway.NAME,
                        'finished.');
                    f(a);
                });
            });
        })(data.VGATEWAYS[i]);
    }

    //check if vm vagent is start
    //  serial[ [] --->append [] in running time ]
    if (data.VMS.length > 0) {
        var check_vagent_steps = [];
        var check_vagent_flow = new flow.serial(check_vagent_steps);
        flow_steps.push(check_vagent_flow);
        check_vagent_steps.push(function(a, f){
            var real_steps = []
            data.VMS.forEach(function(vm){
                if (vm.LCUUID && vm.STATE == 4){
                    real_steps.push(function(a, f) {
                        Vm_Snapshot.prototype.checkVagent(vm.LCUUID,
                            function(){f(a)}, function(){f(a)})
                    });
                }
            })
            check_vagent_steps.push(real_steps);
            f(a);
        })
    }
    for (i = 0; i < data.VMS.length; ++i) {
        (function(vm) {
            flow_steps.push(function(a, f) {
                if (!('ID' in vm)) {
                    logger.error(
                        'Solution', data.NAME, 'create continue but vif attach is ignored',
                        'since VM', vm.NAME, 'create failed.');
                    f(a);
                    return;
                }
                var intf_json = get_vif_attach_array(data, INSTANCE_TYPE_VM, vm);
                var vm_vif_attach = {
                    operator_name: data.operator_name,
                    id: vm.ID,
                    action: VM_PATCH_VIF_ACTION,
                    gateway: vm.GATEWAY,
                    interfaces: intf_json,
                }
                logger.info(
                    'Solution', data.NAME,
                    'create continue and will attach vif to vm', vm.NAME,
                    ':', vm_vif_attach.interfaces);
                vm_obj[VM_PATCH_VIF_ACTION](vm_vif_attach,
                    function(){
                        logger.info(
                            'Solution', data.NAME,
                            'create continue since vif attach of VM', vm_vif_attach.id,
                            'finished:', arguments);
                        f(a);
                    },
                    function() {
                        logger.error(
                            'Solution', data.NAME,
                            'create continue but vif attach of VM', vm_vif_attach.id,
                            'failed:', arguments);
                        f(a);
                    }
                );
            });
        })(data.VMS[i]);
    }
}

Solution.prototype.create = function(data, standard_create, standard_action, callback, errorcallback) {
    /*
     * http://10.33.2.200/dokuwiki/doku.php/产品设计/研发文档/v3.2文档/solution_api
     */
    var p = this;
    p.action = 'create';

    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    data.QOS_DEMAND = [];
    data.OPT_STATUS = constr.OPT.SUCCESS;
    /* STEP 1: check balance */
    check_balance(data, flow_steps, app, standard_action, callback, errorcallback);

    /* STEP 2: create solution */
    create_solution(data, flow_steps, app,
            standard_create, standard_action, callback, errorcallback);

    /* STEP 3: charge */
    flow_steps.push(function(a, f) {
        var charge = new order_charge();
        var charge_data = {
            order_id: data.ORDER_ID,
            domain: data.DOMAIN,
            userid: data.USERID,
            detail: JSON.stringify({
                VMS: [{}],
                VGWS: [{}],
                IPS: [{}],
                BANDWIDTHS: [{}],
            }),
        };
        charge.get(charge_data, function(charge_response){f(charge_response);}, errorcallback);
    });

    /* STEP 4: notify web */
    flow_steps.push(function(charge_response, f) {
        delete(charge_response['OPT_STATUS']);
        charge_response.opt_status = data.OPT_STATUS;
        charge_response.orderid = data.ORDER_ID;
        p.getSession(data.USERID, function(ans){
            if (ans != null && ans.length > 0) {
                charge_response.session = ans[0].session;
                charge_response.useruuid = ans[0].useruuid;
                p.callbackWeb('/order/confirmorder', 'post', charge_response, function(resp) {
                    logger.info('Solution', data.NAME, 'create continue since notify web finished:', arguments);
                    f(charge_response);
                },function() {
                    logger.error('Solution', data.NAME, 'create continue but notify web failed:', arguments);
                    f(charge_response);
                });
            }
        }, function(){});
    });

    /* STEP 5: fire */
    app.fire(
        '',
        function() {
            if (data.OPT_STATUS == constr.OPT.SUCCESS) {
                p.sendToMsgCenter({
                    type: 'user',
                    target: data.USERID,
                    msg: {
                        action: 'create',
                        state: 'success',
                        type: 'order',
                        id: data.ORDER_ID,
                        data: {state: 2}
                    }
                });
            }
            operationLog.update({
                objecttype:'epc', objectid:data.EPC_ID, opt_result:1
            });
            logger.info('Solution', data.NAME, 'create finished.');
        }
    );
}

module.exports=Solution;
