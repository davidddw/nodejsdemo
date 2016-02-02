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
var order_charge = require('./order_charge.js');
var thirdParty = require('./third_party_device.js');
var storage = require('./storage.js');
var Order = function() {Obj.call(this);}

util.inherits(Order, Obj);

Order.prototype.create = function(data, standard_create, standard_action, callback, errorcallback) {
    var i, j;
    var isp_obj = new Isp();
    var epc_obj = new Epc();
    var flow_steps = [];
    var app = new flow.serial(flow_steps);
    var charge_ok = 0;
    var p = this;
    var domainas = [];
    var index = 0;
    var domain_charge,domain_lcuuid;
    data.OPT_STATUS = constr.OPT.SUCCESS;

    var domain_map = new Map();

    var errorMsgs = [];

    atry(function(){
        flow_steps.push(function(a, f) {
            callback({OPT_STATUS: 'SUCCESS'});
            var inner_flow_steps = [];
            var inner_app = new flow.serial(inner_flow_steps);
            if('IPS' in data){
                for (i = 0; i < data.IPS.length; ++i) {
                    var ips = data.IPS[i];
                    if(!lc_utils.checkInstanceNum({type:'IPS',num:ips.IP_NUM})){
                        logger.info('fail@1');
                        errorMsgs.push('ip个数超出最大限制');
                        data.OPT_STATUS = constr.OPT.FAIL;
                        f(a);
                    }

                    for(j = 0; j < ips.IP_NUM; ++j){
                        var isp_create = {operator_name: data.operator_name,userid: data.USERID,
                                order_id: data.ORDER_ID,isp: ips.ISP,domain:ips.DOMAIN,operator_name : data.operator_name};
                        if(!domain_map.get(ips.DOMAIN)){
                            domain_map.put(ips.DOMAIN,ips.DOMAIN);
                            domainas[index] = ips.DOMAIN;
                            index ++;
                        }
                        (function(isp_create){
                            inner_flow_steps.push(function(a, f) {
                                isp_obj.user_ip_resources(isp_create,
                                    function(resp){
                                        if (arguments.length == 1 && 'DATA' in resp && 'IP_RESOURCE_LCUUID' in resp.DATA) {
                                            logger.info('order_id', data.ORDER_ID,'create continue since IP in ISP', isp_create.isp,'create finished:', arguments);
                                        } else {
                                            errorMsgs.push('创建IP失败');
                                            data.OPT_STATUS = constr.OPT.FAIL;
                                        }
                                        f(a);
                                    },
                                    function() {
                                        errorMsgs.push('创建IP失败');
                                        data.OPT_STATUS = constr.OPT.FAIL;
                                        logger.error('order_id', data.ORDER_ID,'create continue but IP in ISP', isp_create.isp,'create failed:', arguments);
                                        f(a);
                                    }
                                );
                            });
                        })(isp_create);
                    }
                }
            }

            if('BANDWIDTHS' in data){
                /* STEP 5: create bandwidth */
                for (i = 0; i < data.BANDWIDTHS.length; ++i) {
                    var bw_create = {
                        operator_name: data.operator_name,
                        USERID: data.USERID,
                        ORDER_ID: data.ORDER_ID,
                        ISP: data.BANDWIDTHS[i].ISP,
                        BANDWIDTH: data.BANDWIDTHS[i].BANDWIDTH,
                        PRODUCT_SPECIFICATION_LCUUID: data.BANDWIDTHS[i].PRODUCT_SPECIFICATION_LCUUID,
                        DOMAIN: data.BANDWIDTHS[i].DOMAIN
                    };
                    if(!domain_map.get(data.BANDWIDTHS[i].DOMAIN)){
                        domain_map.put(data.BANDWIDTHS[i].DOMAIN, data.BANDWIDTHS[i].DOMAIN);
                        domainas[index] = data.BANDWIDTHS[i].DOMAIN;
                        index ++;
                    }
                    if(!lc_utils.checkInstanceNum({type:'BANDWIDTHS',num:data.BANDWIDTHS[i].BANDWIDTH / 1024 / 1024})){
                        errorMsgs.push('带宽超出最大限制');
                        data.OPT_STATUS = constr.OPT.FAIL;
                        f(a);
                    }
                    (function(bw_create){
                        inner_flow_steps.push(function(a, f) {
                            isp_obj.user_order_isp_bandwidths(bw_create,
                                function(){
                                    if (arguments.length != 1) {
                                        errorMsgs.push('带宽创建失败');
                                        data.OPT_STATUS = constr.OPT.FAIL;
                                    }
                                    logger.info(
                                        'order_id', data.ORDER_ID, 'create continue since', bw_create.BANDWIDTH,
                                        'Bit', bw_create.PRODUCT_SPECIFICATION_LCUUID,
                                        'bandwidth of ISP', bw_create.ISP, 'create finished:', arguments);
                                    f(a);
                                },
                                function() {
                                    errorMsgs.push('带宽创建失败');
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                    logger.error(
                                        'order_id', data.ORDER_ID, 'create continue since', bw_create.BANDWIDTH,
                                        'Bit', bw_create.PRODUCT_SPECIFICATION_LCUUID,
                                        'bandwidth of ISP', bw_create.ISP, 'create failed:', arguments);
                                    f(a);
                                }
                            );
                       });
                   })(bw_create);
               }
            }

            if('VGWS' in data){
                if(!lc_utils.checkInstanceNum({type:'VGWS',num:data.VGWS.length},errorcallback)){
                        logger.info('fail@7');
                    data.OPT_STATUS = constr.OPT.FAIL;
                    f(a);
                }
                for (i = 0; i < data.VGWS.length; ++i) {
                    var vgateway = data.VGWS[i];
                    var vgateway_create = {domain: data.DOMAIN,allocation_type: 'AUTO',userid: data.USERID,order_id: data.ORDER_ID,
                                           name: vgateway.NAME,product_specification_lcuuid: vgateway.PRODUCT_SPECIFICATION_LCUUID,
                                           domain:vgateway.DOMAIN,operator_name : data.operator_name};
                    logger.info('create VGATEWAY started',vgateway_create);
                    if(!domain_map.get(vgateway.DOMAIN)){
                        domain_map.put(vgateway.DOMAIN,vgateway.DOMAIN);
                        domainas[index] = vgateway.DOMAIN;
                        index ++;
                    }

                    (function(vgateway_create){
                        inner_flow_steps.push(function(a, f) {
                            standard_create('vgateway', vgateway_create, function(resp) {
                                if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA) {
                                   vgateway.ID = resp.DATA.ID;
                                   logger.info('order_id', data.ORDER_ID, 'create continue since VGATEWAY', vgateway.NAME,'create returned:', arguments);
                                } else {
                                    logger.info('fail@8');
                                     data.OPT_STATUS = constr.OPT.FAIL;
                                }
                            })('', function(a){
                                if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                                    logger.info('fail@9');
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since VGATEWAY', vgateway.NAME,'create finished.');
                                f(a);
                            });
                        });
                    })(vgateway_create)
                }
            }

            if('BWTS' in data){
                if(!lc_utils.checkInstanceNum({type:'BWTS',num:data.BWTS.length},errorcallback)){
                logger.info('fail@10');
                    data.OPT_STATUS = constr.OPT.FAIL;
                    f(a);
                }
                for (i = 0; i < data.BWTS.length; ++i) {
                    var valve = data.BWTS[i];
                    logger.info('create VALVE started');
                    var valve_create = {domain: data.DOMAIN,allocation_type: 'AUTO',userid: data.USERID,order_id: data.ORDER_ID,
                                           name: valve.NAME,product_specification_lcuuid: valve.PRODUCT_SPECIFICATION_LCUUID,
                                           domain:valve.DOMAIN,operator_name : data.operator_name};
                    if(!domain_map.get(valve.DOMAIN)){
                        domain_map.put(valve.DOMAIN,valve.DOMAIN);
                        domainas[index] = valve.DOMAIN;
                        index ++;
                    }

                    (function(valve_create){
                        inner_flow_steps.push(function(a, f) {
                            standard_create('valve', valve_create, function(resp) {
                                if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA) {
                                   valve.ID = resp.DATA.ID;
                                   logger.info('order_id', data.ORDER_ID, 'create continue since VGATEWAY', valve.NAME,'create returned:', arguments);
                                } else {
                                logger.info('fail@11');
                                     data.OPT_STATUS = constr.OPT.FAIL;
                                }
                            })('', function(a){
                                if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                                    logger.info('fail@12');
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since VGATEWAY', valve.NAME,'create finished.');
                                f(a);
                            });
                        });
                    })(valve_create)
                }
            }

            if ('THIRDPARTIES' in data){
                logger.info('create thirdparties');
                var hw = new thirdParty();
                var bm_create_steps = [];
                inner_flow_steps.push(bm_create_steps);
                for (var i = 0; i < data.THIRDPARTIES.length; i++){
                    if(!domain_map.get(data.THIRDPARTIES[i].DOMAIN)){
                        domain_map.put(data.THIRDPARTIES[i].DOMAIN,data.THIRDPARTIES[i].DOMAIN);
                    }
                    (function(i){
                    bm_create_steps.push(function(a, f){
                        data.THIRDPARTIES[i].ORDER_ID = data.ORDER_ID;
                        data.THIRDPARTIES[i].USERID = data.USERID;
                        hw.buyHW(data.THIRDPARTIES[i], function(ack){
                            logger.info(ack);
                            if (ack.OPT_STATUS == constr.OPT.FAIL){
                                data.OPT_STATUS = constr.OPT.FAIL;
                            }
                            f();
                        }).resolve('', logger.info);
                    })
                    })(i)
                }
            }

            if ('BLOCKS' in data){
                logger.info('create blocks');
                var block = new storage();
                var block_create_steps = [];
                inner_flow_steps.push(block_create_steps);
                for (var i = 0; i< data.BLOCKS.length; i++){
                    if(!domain_map.get(data.BLOCKS[i].DOMAIN)){
                        domain_map.put(data.BLOCKS[i].DOMAIN,data.BLOCKS[i].DOMAIN);
                    }
                    (function(i){
                        block_create_steps.push(function(a, f){
                            data.BLOCKS[i].ORDER_ID = data.ORDER_ID;
                            delete(data.BLOCKS[i].DOMAIN);
                            block.create(data.BLOCKS[i], function(ack){
                                logger.info(ack);
                                if (ack.OPT_STATUS == constr.OPT.FAIL){
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                f();
                            }).resolve('', logger.info);
                        })
                    })(i)
                }
            }

            if('VMS' in data){
                if(!lc_utils.checkInstanceNum({type:'VMS',num:data.VMS.length},errorcallback)){
                logger.info('fail@13');
                    data.OPT_STATUS = constr.OPT.FAIL;
                    f(a);
                }
                for (i = 0; i < data.VMS.length; ++i) {
                    if (i % constr.MAX_VM_CONCURRENCY == 0){
                        var vm_create_steps = [];
                        inner_flow_steps.push(vm_create_steps);
                    }
                    var vm = data.VMS[i];
                    var vm_create = {type: 'vm',allocation_type: 'auto',userid: data.USERID,order_id: data.ORDER_ID,
                            passwd: vm.PASSWD,product_specification_lcuuid: vm.PRODUCT_SPECIFICATION_LCUUID,
                            os: vm.OS,name: vm.NAME,role: vm.ROLE, vcpu_num: vm.VCPU_NUM,mem_size: vm.MEM_SIZE,
                            sys_disk_size : vm.SYS_DISK_SIZE,user_disk_size:vm.USER_DISK_SIZE,domain:vm.DOMAIN,
                            operator_name : data.operator_name};

                    if(!domain_map.get(vm.DOMAIN)){
                        domain_map.put(vm.DOMAIN,vm.DOMAIN);
                        domainas[index] = vm.DOMAIN;
                        index ++;
                    }
                    (function(vm_create){
                        vm_create_steps.push(function(a, f) {
                            standard_create('vm', vm_create, function(resp) {
                                if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA && 'ERRNO' in resp.DATA && resp.DATA.ERRNO == 0) {
                                    vm.ID = resp.DATA.ID;
                                }else{
                                logger.info('fail@14');
                                     data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since VM', vm.NAME,'create returned:', arguments);
                            })('', function(a){
                                if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                                logger.info('fail@15');
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since VM', vm.NAME,'create finished.');
                                f(a);
                            });
                        });
                    })(vm_create);
                }
            }

            if('VFWS' in data){
                if(!lc_utils.checkInstanceNum({type:'VFWS',num:data.VFWS.length},errorcallback)){
                logger.info('fail@16');
                    data.OPT_STATUS = constr.OPT.FAIL;
                    f(a);
                }
                for (i = 0; i < data.VFWS.length; ++i) {
                    var vfw = data.VFWS[i];
                    var vfw_create = {type: 'vfw',allocation_type: 'auto',userid: data.USERID,order_id: data.ORDER_ID,
                            passwd: vfw.PASSWD,product_specification_lcuuid: vfw.PRODUCT_SPECIFICATION_LCUUID,
                            os: vfw.OS,name: vfw.NAME,role: vfw.ROLE, vcpu_num: vfw.VCPU_NUM,mem_size: vfw.MEM_SIZE,
                            sys_disk_size : vfw.SYS_DISK_SIZE,user_disk_size:vfw.USER_DISK_SIZE,domain:vfw.DOMAIN,
                            operator_name : data.operator_name};

                    if(!domain_map.get(vfw.DOMAIN)){
                        domain_map.put(vfw.DOMAIN,vfw.DOMAIN);
                        domainas[index] = vfw.DOMAIN;
                        index ++;
                    }
                    (function(vfw_create){
                        inner_flow_steps.push(function(a, f) {
                            standard_create('vm', vfw_create, function(resp) {
                                if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA && 'ERRNO' in resp.DATA && resp.DATA.ERRNO == 0) {
                                    vfw.ID = resp.DATA.ID;
                                }else{
                                logger.info('fail@17');
                                     data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since VFW', vfw.NAME,'create returned:', arguments);
                            })('', function(a){
                                if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                                    logger.info('fail@18');
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since VFW', vfw.NAME,'create finished.');
                                f(a);
                            });
                        });
                    })(vfw_create);
                }
            }

            if('LBS' in data){
                if(!lc_utils.checkInstanceNum({type:'LBS',num:data.LBS.length},errorcallback)){
                logger.info('fail@19');
                    data.OPT_STATUS = constr.OPT.FAIL;
                    f(a);
                }
                for (i = 0; i < data.LBS.length; ++i) {
                    var lb = data.LBS[i];
                    var lb_create = {type: 'lb',allocation_type: 'auto',userid: data.USERID,
                            order_id: data.ORDER_ID,passwd: lb.PASSWD,name: lb.NAME,os: '',
                            product_specification_lcuuid: lb.PRODUCT_SPECIFICATION_LCUUID,role: lb.ROLE,
                            vcpu_num: lb.VCPU_NUM,mem_size: lb.MEM_SIZE,sys_disk_size : lb.SYS_DISK_SIZE,
                            user_disk_size:lb.USER_DISK_SIZE,domain:lb.DOMAIN,operator_name : data.operator_name};

                    if(!domain_map.get(lb.DOMAIN)){
                        domain_map.put(lb.DOMAIN,lb.DOMAIN);
                        domainas[index] = lb.DOMAIN;
                        index ++;
                    }
                    (function(lb_create){
                        inner_flow_steps.push(function(a, f) {
                            standard_create('vm', lb_create, function(resp) {
                                if (arguments.length == 1 && 'DATA' in resp && 'ID' in resp.DATA && 'ERRNO' in resp.DATA && resp.DATA.ERRNO == 0) {
                                    lb.ID = resp.DATA.ID;
                                }else{
                                logger.info('fail@20');
                                     data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since LB', lb.NAME,'create returned:', arguments);
                            })('', function(a){
                                if(typeof(a) == 'number' || ('data' in a && 'errno' in a.data && a.data.errno != 0)){
                                    logger.info('fail@21');
                                    data.OPT_STATUS = constr.OPT.FAIL;
                                }
                                logger.info('order_id', data.ORDER_ID, 'create continue since LB', lb.NAME,'create finished.');
                                f(a);
                            });
                        });
                    })(lb_create)
                }
            }
            inner_app.fire('', function(){logger.info('order_id', data.ORDER_ID,'create continue finished.');f(a);});
        })
        flow_steps.push(function(a, f) {
            var domains = domain_map.keySet();
            var domain_flow_steps = [];
            var domain_app = new flow.serial(domain_flow_steps);

            for(var i=0;i<domains.length;i++){
                domain_lcuuid = domains[i];
                (function(domain_lcuuid){
                    var domain_data = {name:'', userid:data.USERID,domain:domain_lcuuid,operator_name : data.operator_name};
                    domain_flow_steps.push(function(a, f) {
                        var condition = 'select * from ?? where ??=?';
                        var param = [];

                        param.push('domain');
                        param.push(domain_lcuuid);

                        if ('USERID' in data) {
                            condition += ' and ??=?';
                            param.push('userid');
                            param.push(data.USERID);
                        }
                        p.executeSql(condition)(
                                [Epc.prototype.tableName].concat(param),
                                function(ans){
                                    if (ans.length == 0) {
                                        epc_obj.create(domain_data,function(resp){
                                            logger.info('order_id', data.ORDER_ID,'create epc ', domain_lcuuid,' create finished:', arguments);
                                        },
                                        function() {
                                        logger.info('fail@23');
                                            data.OPT_STATUS = constr.OPT.FAIL;
                                            logger.error('order_id', data.ORDER_ID,'create epc ', domain_lcuuid,'create failed:', arguments);
                                            f(a);
                                        });
                                    }
                                    f(a);
                                },
                                function(a){errorcallback(a), app.STD_END()}
                            );
                })
                })(domain_lcuuid);
            }
            domain_app.fire('',function() {logger.info('order_id', data.ORDER_ID, ' epc create finished.');f(a);});
        })
    }).catch(function(err){
    logger.info('fail@24');
         data.OPT_STATUS = constr.OPT.FAIL;
    });
    flow_steps.push(function(a, f) {
        var charge = new order_charge();
        var charge_data = {"id":data.ORDER_ID,"domain":domain_lcuuid,"userid":data.USERID,detail:JSON.stringify(data)};
        charge.get(charge_data, function(charge_response){f(charge_response);}, logger.info);
    });
    flow_steps.push(function(charge_response, f) {
        delete(charge_response['OPT_STATUS']);
        charge_response.opt_status = data.OPT_STATUS;
        charge_response.orderid = data.ORDER_ID;
        p.callbackWeb('/order/confirmorder', 'post', charge_response, function(resp){
            logger.info('order_id', data.ORDER_ID,'create continue since notify web finished:', arguments);
            f(charge_response);
        },function() {
            logger.error('order_id', data.ORDER_ID,'create continue but notify web failed:', arguments);
            f(charge_response);
        });
        if(data.OPT_STATUS == constr.OPT.SUCCESS ){
            p.sendToMsgCenter({type:'user', target:data.USERID,msg:{action:'create', state:'success', type:'order', id:data.ORDER_ID, data:{state:2}} });
        }
    });
    app.fire('',function() {logger.info('order_id', data.ORDER_ID, 'create finished.');});
}

function Map(){
    this.container = new Object();
}

Map.prototype.put = function(key, value){
    this.container[key] = value;
}

Map.prototype.get = function(key){
    return this.container[key];
}

Map.prototype.keySet = function() {
    var keyset = new Array();
    var count = 0;
    for (var key in this.container) {
        if (key == 'extend') {
            continue;
        }
        keyset[count] = key;
        count++;
    }
    return keyset;
}

module.exports = Order;
