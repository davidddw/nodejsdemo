var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var lc_utils = require('./lc_utils.js');
var Vl2 = require('./vl2.js');
var operationLog = require('./operation_log.js');
var constr = require('./const.js');
var Cashier = require('./cashier.js');
var Domain = require('./domain.js')
var api = require('./api.js');
var Task = require('./task.js');
var db = require('./db.js');
var data = require('./data.js');
var uuid = require('node-uuid');

var getMs = function(filter){
    return api.scallTalker('GET', 'v1/micro-segments', filter);
}


var createMs = function(params){
    params = lc_utils.upperJsonKey(params);
    var Q = new flow.Qpack(flow.serial);
    Q.setData('startTime', new Date().toMysqlFormat());
    //Q.then(data.checkParamsValid({
    //    'data': params,
    //    'validator': data.createMs(),
    //}))
    Q.then(db.fetch('epc_v2_2', {id: params.EPC_ID}, function(ans){
        Q.setData('userid', ans[0].userid);
    }))
    .then(function(ans){
        Q.then(api.scallTalker('POST', 'v1/micro-segments', params, function(ans){
            comment = '创建微安全域' + ans.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'ms',
                objectid: ans.ID,
                object_userid: Q.getData('userid'),
                opt_result: 1,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: ans.NAME,
                comment: comment,
            });
            return ans;
        }));
    })
    return Q;
}

var delMs = function(lcuuid, ifLog){
    //call talker delete ms;
    var Q = new flow.Qpack(flow.serial);
    Q.setData('startTime', new Date().toMysqlFormat());

    Q.then(api.callTalker('GET', 'v1/micro-segments/'+lcuuid, '', function(ack){
        ack = ack.body.DATA;
        Q.setData('msData'+lcuuid, ack);
        return {id: ack.EPC_ID};
    }))
    .then(db.fetch('epc_v2_2', '', function(ans){
        Q.setData('userid', ans[0].userid);
    }))
    .then(api.scallTalker('DEL', 'v1/micro-segments/'+lcuuid, '', function(ans){
        ans = Q.getData('msData'+lcuuid);
        if (ifLog){
            comment = '删除微安全域' + ans.NAME;
            db.insert('operation_log'+constr.SQL_VERSION, {
                objecttype: 'ms',
                objectid: ans.ID,
                object_userid: Q.getData('userid'),
                opt_result: 1,
                start_time: Q.getData('startTime'),
                end_time: new Date().toMysqlFormat(),
                operator_name: Q.getData('operatorName'),
                name: ans.NAME,
                comment: comment,
            })
        }
    }));
    return Q;
}

var plugL3Node = function(options){
    var lcuuid = options.lcuuid;
    var Q = new flow.Qpack(flow.serial);
    var if1 = {
        STATE:1,
        IF_TYPE: 'WAN',
        WAN: {
            IPS: [{IP_RESOURCE_LCUUID: options.ip}],
            QOS: {MIN_BANDWIDTH: options.bandwidth * 1024 * 1024,
                MAX_BANDWIDTH: options.bandwidth * 1024 * 1024}
        },
    }, if2 = {
        STATE:1,
        IF_TYPE: 'LAN',
        LAN: {
            VL2_LCUUID: options.vl2_lcuuid,
            IP_ALLOCATION_MODE: "AUTO",
            QOS: {MIN_BANDWIDTH: 0, MAX_BANDWIDTH: 2000 *1024 * 1024}
        }
    };
    if (options.type == 'VGATEWAY'){
        var url = 'v1/vgateways/' + lcuuid;
        if1.IF_INDEX = 1;
        if2.IF_INDEX = 10;
        var patchData = [if1, if2];
        return Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: patchData}));
    } else {
        var url = 'v1/vms/' + lcuuid;
        if1.IF_INDEX = 0;
        if2.IF_INDEX = 1;
        return Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if1]}))
                .then(Task.prototype.asyncTask('PATCH', url, {GATEWAY: options.gateway,
                    INTERFACES: [if2]}))
    }
}

var plugLanChainNode = function(options){
    var Q = new flow.Qpack(flow.serial);
    var if1 = {
        STATE:1,
        IF_TYPE: 'LAN',
        IF_INDEX: 0,
        SUBTYPE: {IS_L2_INTERFACE: true},
        LAN: {
            VL2_LCUUID: options.vl2_lcuuid,
            QOS: {MIN_BANDWIDTH: 0, MAX_BANDWIDTH: 2000 * 1024 * 1024}
        },
    }, if2 = {
        STATE:1,
        IF_TYPE: 'LAN',
        IF_INDEX: 1,
        SUBTYPE: {IS_L2_INTERFACE: true},
        LAN: {
            VL2_LCUUID: options.vl2_lcuuid,
            QOS: {MIN_BANDWIDTH: 0, MAX_BANDWIDTH: 2000 * 1024 * 1024}
        },
    };
    var url = 'v1/vms/' + options.lcuuid;
    return Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if1]}))
            .then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if2]}));
}


var plugWanChainNode = function(options){
    var Q = new flow.Qpack(flow.serial);
    var if1 = {
        STATE:1,
        IF_TYPE: 'WAN',
        IF_INDEX: 0,
        SUBTYPE: {IS_L2_INTERFACE: true},
        WAN: {
            ISP_LCUUID: options.isp_lcuuid,
            QOS: {MIN_BANDWIDTH:0, MAX_BANDWIDTH:0},
        },
    }, if2 = {
        STATE:1,
        IF_TYPE: 'WAN',
        IF_INDEX: 1,
        SUBTYPE: {IS_L2_INTERFACE: true},
        WAN: {
            ISP_LCUUID: options.isp_lcuuid,
            QOS: {MIN_BANDWIDTH:0, MAX_BANDWIDTH:0},
        },
    };
    if (options.type == 'VGATEWAY'){
        var url = 'v1/vgateways/' + options.lcuuid;
        return Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if1, if2]}));
    } else {
        var url = 'v1/vms/' + options.lcuuid;
        Q.then(function(){
            if (Q.getData('vlantag')){
                if1.WAN.VLANTAG = Q.getData('vlantag');
                if2.WAN.VLANTAG = Q.getData('vlantag');
            }
            Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if1]}))
                .then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if2]}));
        })
        return Q;
    }
}

var unplugChainNode = function(options){
    var lcuuid = options.lcuuid,
    type = options.type,
    is_l3 = options.is_l3;
    var Q = new flow.Qpack(flow.serial);
    var if1 = {
        STATE: 2,
        IF_INDEX: 0
    }, if2 = {
        STATE: 2,
        IF_INDEX: 1,
    };
    if (!is_l3){
        if1.SUBTYPE = {IS_L2_INTERFACE: true};
        if2.SUBTYPE = {IS_L2_INTERFACE: true};
    }
    if (type != 'VGATEWAY'){
        var url = '/v1/vms/' + lcuuid;
        return Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if1]}))
                .then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if2]}));
    } else {
        if1.IF_INDEX = 1;
        if2.IF_INDEX = 10;
        var url = '/v1/vgateways/' + lcuuid;
        return Q.then(Task.prototype.asyncTask('PATCH', url, {INTERFACES: [if1, if2]}))
    }
}

var delChain = function(lcuuid, callback){
    var Q = new flow.Qpack(flow.serial);
    Q.then(api.scallTalker('GET', 'v1/micro-segment-flows/'+lcuuid), '', function(ack){
        Q.setData('chainData'+lcuuid, ack)
    })
    .then(api.scallTalker('DEL', 'v1/micro-segment-flows/'+lcuuid))
    var Q2 = new flow.Qpack(flow.parallel);
    Q.then(function(){
        Q.getData('chainData'+lcuuid).SERVICES.forEach(function(node){
            logger.info(node.INSTANCE_LCUUID)
            Q2.then(unplugChainNode({
                lcuuid: node.INSTANCE_LCUUID, type: node.INSTANCE_TYPE, is_l3: false}))
        })
        Q.then(Q2);
    })
    if (callback){
        Q.then(function(ack){
            callback({OPT_STATUS: constr.OPT.SUCCESS})
            return ack;
        })
    }
    return Q;
}

//params: {lcuuid: xxx, if_index:0};
var clearVifMs = function(params, callback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(function(code, body){callback({code:code, body:body})});
    Q.then(api.scallTalker('GET', 'v1/micro-segments/', {
        instance_type: 'VM',
        instance_lcuuid: params.lcuuid,
        instance_ifindex: params.if_index
    }))
    var Q3 = new flow.Qpack(flow.serial);
    Q.then(function(ms){
        if (ms.length == 0){
            return true;
        }
        ms = ms[0];
        Q3.then(function(){
            if (ms.IS_DEFAULT)
                return true;
            if (ms.TYPE == 'HOST' && ms.NAME != params.lcuuid+'_0'){
                return true;
            }
            var Q2 = new flow.Qpack(flow.parallel);
            Q2.then(api.scallTalker('GET', 'v1/micro-segment-flows', {
                'src_ms_lcuuid': ms.LCUUID,
            }))
            .then(api.scallTalker('GET', 'v1/micro-segment-flows', {
                'dst_ms_lcuuid': ms.LCUUID,
            }))
            Q3.then(Q2).then(function(res){
                if (res[0].length || res[1].length){
                    return false;
                } else {
                    Q3.then(delMs(ms.LCUUID)).then(function(){
                        return true;
                    });
                }
            })
        })
    }).then(Q3);
    return Q.then(function(ans){logger.info('check vif: ', ans); callback(ans)});
}


var createChain = function(params, callback){
    var Q = new flow.Qpack(flow.serial);
    //Q.then(data.checkParamsValid({
    //    'data': params,
    //    'validator': data.createChain(),
    //}));
    //del exist flow
    callback && Q.setRejectHandler(callback);
    Q.then(getMsChain({
        src_ms_lcuuid: params.SRC_MS_LCUUID,
        dst_ms_lcuuid: params.DST_MS_LCUUID,
        epc_id: params.EPC_ID,
    }))
    .then(function(ack){
        if (ack.length){
            Q.then(delChain(ack[0].LCUUID));
        }
        //plug service node
        var Q2 = new flow.Qpack(flow.parallel);
        var rQ1 = new flow.Qpack(flow.parallel);
        Q.setRollBack(rQ1);
        params.SERVICES.forEach(function(serviceNode){
            if (serviceNode.IS_PLUGGED){
                return;
            }
            if (!params.ISP_LCUUID){
                Q2.then(plugLanChainNode(
                    {lcuuid: serviceNode.INSTANCE_LCUUID, vl2_lcuuid: params.VL2_LCUUID}))
                serviceNode.IS_PLUGGED = true;
                rQ1.then(unplugChainNode({
                    lcuuid: serviceNode.INSTANCE_LCUUID, type: serviceNode.INSTANCE_TYPE,
                    is_l3: false
                }))
            } else {
                Q2.then(plugWanChainNode({lcuuid: serviceNode.INSTANCE_LCUUID,
                    isp_lcuuid: params.ISP_LCUUID, type: serviceNode.INSTANCE_TYPE}))
                serviceNode.IS_PLUGGED = true;
                rQ1.then(unplugChainNode({
                    lcuuid: serviceNode.INSTANCE_LCUUID, type: serviceNode.INSTANCE_TYPE,
                    is_l3: true,
                }))
            }
            serviceNode.INGRESS_IF_INDEX = 0;
            serviceNode.EGRESS_IF_INDEX = 1;
        })
        Q.then(Q2);
        params.NAME = 'chainname';
        //call talker post chain
        Q.then(api.scallTalker('POST', '/v1/micro-segment-flows/', params))
        if (callback){
            Q.then(function(ack){callback({OPT_STATUS: constr.OPT.SUCCESS, DATA: ack}); return ack});
        } else {
            Q.then(function(ack){
                Q.setRollBack(api.scallTalker('DEL', '/v1/micro-segment-flows/'+ack.LCUUID));
                return ack;
            })
        }
    })
    return Q;
}

var createSouthNorthChain = function(params, callback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(callback);
    Q.join(delSouthNorthChain({
        isp_lcuuid:params.ISP_LCUUID,
        vl2_lcuuid:params.VL2_LCUUID,
        epc_id:params.EPC_ID
    }))
    Q.then(function(ack){
        if (ack.code == 200){
            if (!params.SERVICES || params.SERVICES == 0){
                Q.reject({OPT_STATUS:constr.OPT.SUCCESS});
            }
        } else if (ack.code) {
            Q.reject(ack.code, ack.body);
        } else {
            Q.reject({OPT_STATUS: constr.OPT.SERVER_ERROR});
        }
    })
    //Q.then(data.checkParamsValid({
    //    'data': params,
    //    'validator': data.createSouthNorthChain(),
    //}));
    Q.then(db.fetch('epc_v2_2', {id: params.EPC_ID}))
    .then(function(ack){
        logger.info(ack);
        Q.setData('userid', ack[0].userid);
    })
    Q.then(api.scallTalker('GET','v1/isps/'+params.ISP_LCUUID))
    .then(function(ack){
        logger.info(ack);
        Q.setData('isp', ack.ISP);
    })

    //partition service node
    Q.then(function(){
        var northServiceNodes = [], southServiceNodes = [];
        var current = northServiceNodes;
        var l3Node;
        for (var i = 0; i < params.SERVICES.length; i++){
            var serviceNode = params.SERVICES[i];
            if (!serviceNode.IS_L3){
                current.push(serviceNode)
            } else {
                if (l3Node){
                    Q.reject({
                        OPT_STATUS: constr.OPT.FAILED,
                        DESCRIPTION: '只允许有一个设备上配置公网IP'
                    })
                    return;
                };
                l3Node = serviceNode;
                current = southServiceNodes;
            }
            delete(serviceNode.IS_L3);
        }
        if (!l3Node){
            Q.reject({
                OPT_STATUS: constr.OPT.FAILED,
                DESCRIPTION: '至少有一个设备上配置公网IP'
            })
            return;
        };
        Q.then(lc_utils.checkBandwidth_v3({
            'isp': Q.getData('isp'),
            'userid': Q.getData('userid'),
            'type': l3Node.INSTANCE_TYPE,
            'lcuuid': l3Node.INSTANCE_LCUUID,
            'bandw': params.BANDWIDTH,
        }))
        Q.then(api.scallTalker('GET', 'v1/ip-resources/'+params.PUBLIC_IP_LCUUID, '', function(ack){
            if (ack.length){
                Q.setData('vlantag', ack[0].VLANTAG);
            } else {
                logger.error('vlantag of ip'+params.PUBLIC_IP_LCUUID+' not found');
                Q.reject(400, {OPT_STATUS: constr.OPT.SERVER_ERROR});
            }
        }))
        //plug l3Node
        Q.then(plugL3Node({
            lcuuid: l3Node.INSTANCE_LCUUID,
            ip: params.PUBLIC_IP_LCUUID,
            bandwidth: params.BANDWIDTH,
            vl2_lcuuid: params.VL2_LCUUID,
            type: l3Node.INSTANCE_TYPE,
            gateway: l3Node.GATEWAY,
        }))
        //create northMS and l3Node-ISP chain of l3Node
        var Q6 = new flow.Qpack(flow.parallel);
        var Q3 = new flow.Qpack(flow.serial);
        Q3.then(createMs({
                EPC_ID: params.EPC_ID,
                ISP_LCUUID: params.ISP_LCUUID,
                NAME: l3Node.INSTANCE_LCUUID+'_0',
                INTERFACES: [{
                    INSTANCE_TYPE: l3Node.INSTANCE_TYPE,
                    INSTANCE_LCUUID: l3Node.INSTANCE_LCUUID,
                    IF_INDEX: l3Node.INSTANCE_TYPE == 'VGATEWAY' ? 1 : 0,
                }]
            }))
        .then(function(ack){
            logger.info(ack);
            Q.setRollBack(delMs(ack.LCUUID));
            Q3.setData('ms_0', ack);
        })
        .then(getMs({type: 'ISP', isp_lcuuid: params.ISP_LCUUID}))
        //build up create chain data
        .then(function(ack){
            if (ack.length){
                var ms_isp = ack[0];
                Q3.then(createChain({
                    SRC_MS_LCUUID: ms_isp.LCUUID,
                    DST_MS_LCUUID: Q3.getData('ms_0').LCUUID,
                    EPC_ID: params.EPC_ID,
                    ISP_LCUUID: params.ISP_LCUUID,
                    SERVICES: northServiceNodes,
                }))
            } else {
                logger.error('ms isp of '+ params.ISP_LCUUID +' not found');
                Q.reject(400, {OPT_STATUS: constr.OPT.SERVER_ERROR});
            }
        })
        Q6.then(Q3);

        //create southMs and vl2s-ISP chain of vgatway
        var Q4 = new flow.Qpack(flow.serial);
        Q4.then(createMs({
                EPC_ID: params.EPC_ID,
                VL2_LCUUID: params.VL2_LCUUID,
                NAME: l3Node.INSTANCE_LCUUID+'_1',
                TYPE: 'GATEWAY',
                INTERFACES: [{
                    INSTANCE_TYPE: l3Node.INSTANCE_TYPE,
                    INSTANCE_LCUUID: l3Node.INSTANCE_LCUUID,
                    IF_INDEX: l3Node.INSTANCE_TYPE == 'VGATEWAY' ? 10 : 1,
                }]
            }))
            .then(function(ack){
                Q4.setData('ms_1', ack)
                Q.setRollBack(delMs(ack.LCUUID));
            })
            .then(getMs({type: 'HOST', vl2_lcuuid: params.VL2_LCUUID, epc_id: params.EPC_ID}))
            .then(function(ack){
                var vl2Ms = ack;
                var Q5 = new flow.Qpack(flow.serial);
                vl2Ms.forEach(function(ms){
                    Q5.then(createChain({
                        SRC_MS_LCUUID: Q4.getData('ms_1').LCUUID,
                        DST_MS_LCUUID: ms.LCUUID,
                        VL2_LCUUID: params.VL2_LCUUID,
                        EPC_ID: params.EPC_ID,
                        SERVICES: southServiceNodes,
                    }))
                })
                Q4.then(Q5);
            })
        Q6.then(Q4);

        Q.then(Q6);
        if (callback){
            Q.then(function(ack){callback({OPT_STATUS: constr.OPT.SUCCESS})});
        }
    })
    return Q;
}

var delSouthNorthChain = function(filter, callback){
    var Q = new flow.Qpack(flow.serial);
    //find l3Node ms_1
    var findL3Q = new flow.Qpack(flow.parallel);
    Q.then(api.rawCallTalker('GET', 'v1/micro-segments/', {
            type: 'GATEWAY',
            vl2_lcuuid: filter.vl2_lcuuid,
            epc_id: filter.epc_id
        }, function(ack){
            if (ack.code == 200 && ack.body.DATA.length){
                ack = ack.body.DATA;
                ack.forEach(function(ms){
                    logger.info(ms);
                    ms.INTERFACES.forEach(function(node){
                        if (node.INSTANCE_TYPE == 'VGATEWAY'){
                            var getUrl = 'v1/vgateways/'+node.INSTANCE_LCUUID;
                        } else {
                            var getUrl = 'v1/vms/'+node.INSTANCE_LCUUID;
                        }
                        findL3Q.then(api.scallTalker('GET', getUrl, '', function(ack){
                            for (var i=0; i< ack.INTERFACES.length; i++){
                                if (ack.INTERFACES[i].IF_TYPE == 'WAN'){
                                    if (ack.INTERFACES[i].WAN.ISP_LCUUID == filter.isp_lcuuid){
                                        var l3Node = {
                                            INSTANCE_TYPE: node.INSTANCE_TYPE,
                                            INSTANCE_LCUUID: node.INSTANCE_LCUUID,
                                            WAN: ack.INTERFACES[i].WAN,
                                            INSTANCE_NAME: ack.NAME,
                                        };
                                        if ('GATEWAY' in ack){
                                            l3Node.GATEWAY = ack.GATEWAY;
                                        }
                                        Q.setData('l3Node', l3Node);
                                        Q.setData('ms_1', ms);
                                    }
                                }
                            }
                        }))
                    })
                })
            } else {
                Q.reject(200);
                return {code: 200};
            }
        })
    )
    Q.then(findL3Q)
    //find l3Node ms_0
    //get isp, vl2s
    Q.then(getMs({type: 'HOST', vl2_lcuuid: filter.vl2_lcuuid,epc_id: filter.epc_id}))
    .then(function(ack){Q.setData('ms_vl2s', ack)})
    //get ms_isp
    .then(getMs({type: 'ISP', isp_lcuuid: filter.isp_lcuuid,
    }))
    .then(function(ack){
        if (ack.length){
            Q.setData('ms_isp', ack[0])
        } else {
            logger.error('ms of isp '+filter.isp_lcuuid+' not found')
            Q.reject(400, {OPT_STATUS: constr.OPT.SERVER_ERROR});
            return {code:400, body:{OPT_STATUS: constr.OPT.SERVER_ERROR}};
        }
    })
    .then(function(){
        var l3Node = Q.getData('l3Node');
        logger.info('l3Node is ', l3Node);
        if (!l3Node){
            logger.error('l3Node not found, assume flow is deleted.');
            Q.reject(200);
            return {code:200};
        }
        Q.then(api.scallTalker('GET', 'v1/micro-segments/',
            {
                type: 'HOST',
                instance_lcuuid: l3Node.INSTANCE_LCUUID,
                instance_type: l3Node.INSTANCE_TYPE,
                epc_id: filter.epc_id
            }, function(ack){
                if (ack.length){
                    Q.setData('ms_0', ack[0]);
                } else {
                    Q.reject(400, {OPT_STATUS: constr.OPT.SERVER_ERROR});
                    return {code:400, body:{OPT_STATUS: constr.OPT.SERVER_ERROR}};
                }
            })
        )
        .then(unplugChainNode({
            lcuuid: l3Node.INSTANCE_LCUUID, type: l3Node.INSTANCE_TYPE, is_l3: true}))
        .then(function(){
            Q2 = new flow.Qpack(flow.parallel);
            var Q3 = new flow.Qpack(flow.serial);
            //del chain north
            Q3.then(getMsChain({
                src_ms_lcuuid: Q.getData('ms_isp').LCUUID,
                dst_ms_lcuuid: Q.getData('ms_0').LCUUID,
                epc_id: filter.epc_id,
            }))
            .then(function(ack){
                if (ack.length){
                    Q3.then(delChain(ack[0].LCUUID))
                }
            })
            Q2.then(Q3);
            Q.setData('southChainNodes', {});
            var Q7 = new flow.Qpack(flow.serial);
            var Q8 = new flow.Qpack(flow.parallel);
            Q.getData('ms_vl2s').forEach(function(vl2){
                var Q4 = new flow.Qpack(flow.serial);
                Q4.then(getMsChain({
                    src_ms_lcuuid: Q.getData('ms_1').LCUUID,
                    dst_ms_lcuuid: vl2.LCUUID,
                    epc_id: filter.epc_id,
                }))
                .then(function(ack){
                    if (ack.length){
                        Q4.then(api.scallTalker('DEL', 'v1/micro-segment-flows/'+ack[0].LCUUID));
                    }
                    ack[0].SERVICES.forEach(function(service){
                        if (!(service.INSTANCE_LCUUID in Q.getData('southChainNodes'))){
                            Q.getData('southChainNodes')[service.INSTANCE_LCUUID] = service;
                        }
                    })
                })


                //del chain south
                Q8.then(Q4);
            })
            var Q6 = new flow.Qpack(flow.parallel);
            Q7.then(Q8).then(function(){
                for(var i in  Q.getData('southChainNodes')){
                    var service = Q.getData('southChainNodes')[i];
                    Q6.then(unplugChainNode({lcuuid: service.INSTANCE_LCUUID,
                        type:service.INSTANCE_TYPE, is_l3:false}))
                }
            }).then(Q6);
            Q2.then(Q7);
            var Q5 = new flow.Qpack(flow.parallel);
            Q5.then(delMs(Q.getData('ms_1').LCUUID))
            .then(delMs(Q.getData('ms_0').LCUUID))
            Q.then(Q2).then(Q5)
            .then(function(){
                return {code:200};
            })
        })

    })
    //get chain_north chain_south
    return Q;
}

var getMsChain = function(filter){
    return api.scallTalker('GET', 'v1/micro-segment-flows', filter);
}

//get chain cannot access via lcuuid
var getChain = function(filter, callback){
    if ('lcuuid' in filter){
        var lcuuid = filter.lcuuid;
        delete(filter.lcuuid);
    } else {
        var lcuuid = '';
    }
    var Q = new flow.Qpack(flow.serial);
    var p = this;
    Q.then(data.checkParamsValid({
        'data': filter,
        'validator': data.getChainByFilter(),
    }))
    //south-north
    if (('isp_lcuuid' in filter) && ('vl2_lcuuid' in filter)){
        //find l3Node ms_1
        var findL3Q = new flow.Qpack(flow.parallel);
        Q.then(api.scallTalker('GET', 'v1/micro-segments/', {
                type: 'GATEWAY',
                vl2_lcuuid: filter.vl2_lcuuid,
                epc_id: filter.epc_id
            }, function(ack){
                if (ack.length){
                    ack.forEach(function(ms){
                        ms.INTERFACES.forEach(function(node){
                            if (node.INSTANCE_TYPE == 'VGATEWAY'){
                                var getUrl = 'v1/vgateways/'+node.INSTANCE_LCUUID;
                            } else {
                                var getUrl = 'v1/vms/'+node.INSTANCE_LCUUID;
                            }
                            var l3Node = {};
                            findL3Q.then(api.scallTalker('GET', getUrl, '', function(ack){
                                for (var i=0; i< ack.INTERFACES.length; i++){
                                    if (ack.INTERFACES[i].IF_TYPE == 'WAN'){
                                        if (ack.INTERFACES[i].WAN.ISP_LCUUID == filter.isp_lcuuid){
                                            l3Node = {
                                                INSTANCE_TYPE: node.INSTANCE_TYPE,
                                                INSTANCE_LCUUID: node.INSTANCE_LCUUID,
                                                WAN: ack.INTERFACES[i].WAN,
                                                INSTANCE_NAME: ack.NAME,
                                            };
                                            if ('GATEWAY' in ack){
                                                l3Node.GATEWAY = ack.GATEWAY;
                                            }
                                            Q.setData('l3Node', l3Node);
                                            Q.setData('ms_1', ms);
                                        }
                                    } else if (ack.INTERFACES[i].IF_TYPE == 'LAN'){
                                        l3Node.LAN = ack.INTERFACES[i].LAN;
                                    }
                                }
                            }))
                        })
                    })
                } else {
                    Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
                }
            })
        )
        Q.then(findL3Q)
        //find l3Node ms_0
        .then(function(data, onFullfilled){
            if (!Q.getData('l3Node')){
                Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
                onFullfilled();
                return;
            }
            Q.then(api.scallTalker('GET', 'v1/micro-segments/',
                {
                    type: 'HOST',
                    instance_lcuuid: Q.getData('l3Node').INSTANCE_LCUUID,
                    instance_type: Q.getData('l3Node').INSTANCE_TYPE,
                    epc_id: filter.epc_id
                }, function(ack){
                    if (ack.length){
                        Q.setData('ms_0', ack[0]);
                    } else {
                        Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
                    }
                })
            )
            onFullfilled();
        })
        .then(function(data, onFullfilled){
            //get isp, vl2s[0]
            Q.then(getMs({type: 'HOST', vl2_lcuuid: filter.vl2_lcuuid,epc_id: filter.epc_id}))
            .then(function(ack){
                if (ack.length){
                    Q.setData('ms_vl2', ack[0])
                } else {
                    Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
                }
            })
            //get ms_isp
            .then(getMs({type: 'ISP', isp_lcuuid: filter.isp_lcuuid}))
            .then(function(ack){
                if (ack.length){
                    Q.setData('ms_isp', ack[0])
                } else {
                    Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
                }
            })
            onFullfilled();
        })
        //get chain_north chain_south
        .then(function(data, onFullfilled){
            Q.then(function(data, onFullfilled){
                Q.then(getMsChain({
                    src_ms_lcuuid: Q.getData('ms_isp').LCUUID,
                    dst_ms_lcuuid: Q.getData('ms_0').LCUUID,
                    epc_id: filter.epc_id,
                }))
                .then(function(ack){
                    if (ack.length){
                        Q.setData('chain_north', ack[0])
                    } else {
                        Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
                    }
                })
                //var fillQ = new flow.Qpack(flow.parallel);
                //Q.then(function(ack){
                //    Q.setData('chain_north', ack[0])
                //    ack[0].SERVICES.forEach(function(service){
                //        fillQ.then(api.scallTalker('GET', 'v1/vms/'+service.INSTANCE_LCUUID, '',
                //            function(data){
                //                service.NAME = data.NAME;
                //            }
                //        ))
                //    })
                //})
                //Q.then(fillQ)
                .then(getMsChain({
                    src_ms_lcuuid: Q.getData('ms_1').LCUUID,
                    dst_ms_lcuuid: Q.getData('ms_vl2').LCUUID,
                    epc_id: filter.epc_id,
                }))
                .then(function(ack){
                    Q.setData('chain_south', ack[0])
                })
                //var fillQ2 = new flow.Qpack(flow.parallel);
                //Q.then(function(ack){
                //    Q.setData('chain_south', ack[0])
                //    ack[0].SERVICES.forEach(function(service){
                //        fillQ2.then(api.scallTalker('GET', 'v1/vms/'+service.INSTANCE_LCUUID, '',
                //            function(data){
                //                service.NAME = data.NAME;
                //            }
                //        ))
                //    })
                //})
                //Q.then(fillQ2)

                //build ans chain
                .then(function(data, onFullfilled){
                    var ans = {
                        VL2_LCUUID: filter.vl2_lcuuid,
                        ISP_LCUUID: filter.isp_lcuuid,
                        SERVICES: Q.getData('chain_north').SERVICES,
                    };
                    ans.SERVICES.push({
                        INSTANCE_TYPE: Q.getData('l3Node').INSTANCE_TYPE,
                        INSTANCE_LCUUID: Q.getData('l3Node').INSTANCE_LCUUID,
                        WAN: Q.getData('l3Node').WAN,
                        LAN: Q.getData('l3Node').LAN,
                        INSTANCE_NAME: Q.getData('l3Node').INSTANCE_NAME,
                        ACLS: []
                    })
                    Q.getData('chain_south').SERVICES.forEach(function(node){
                        ans.SERVICES.push(node);
                    })
                    if (callback){
                        callback({OPT_STATUS: constr.OPT.SUCCESS, DATA: ans});
                    }
                    onFullfilled(ans);
                })
                onFullfilled();
            })
            onFullfilled();
        })
    } else if ('isp_lcuuid' in filter){
        Q.then(api.scallTalker('GET', 'v1/micro-segments', {
            isp_lcuuid: filter.isp_lcuuid,
            type: 'ISP',
        }))
        .then(function(ack){
            Q.setData('ms_isp', ack.LCUUID);
        })
        .then(api.scallTalker('GET', 'v1/micro-segments/', {
            name: 'ISP_'+filter.isp_lcuuid+'_'+filter.epc_id,
        }))
        .then(function(ack){
            if (ack.length == 0){
                Q.reject(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND});
            } else {
                Q.then(getMsChain({src_ms_lcuuid: Q.getData('ms_isp'), dst_ms_lcuuid: ack[0].LCUUID}));
                if (callback){
                    Q.then(function(ack, onFullfilled){
                        if (ack.length)
                            var ans = ack[0];
                        else
                            var ans = {}
                        callback({OPT_STATUS: constr.OPT.SUCCESS, DATA: ans})
                        onFullfilled({});
                    })
                }
            }
        })
    }
    else {//west-east
        Q.then(getMsChain(filter));
        if (callback){
            Q.then(function(ack, onFullfilled){
                callback({OPT_STATUS: constr.OPT.SUCCESS, DATA: ack})
                onFullfilled(ack[0]);
            })
        }
    }
    return Q;
}

//options: EPC_ID, ISP_LCUUID
var createDirectL3Chain = function(options, callback){
    var Q = new flow.Qpack(flow.serial);
    Q.setRejectHandler(callback);
    Q.then(api.scallTalker('GET', 'v1/micro-segments', {
        isp_lcuuid: options.ISP_LCUUID,
        type: 'ISP',
    }))
    .then(function(ack){
        if (ack.length){
            Q.setData('ms_isp', ack[0].LCUUID);
        } else {
            logger.error('ms isp of '+options.ISP_LCUUID+' not found');
            Q.reject(400, {OPT_STATUS: constr.OPT.SERVER_ERROR});
        }
    })
    .then(api.scallTalker('GET', 'v1/micro-segments/', {
        name: 'ISP_'+options.ISP_LCUUID+'_'+options.EPC_ID,
    }))

    .then(function(ack){
        if (ack.length == 0){
            if (options.SERVICES.length == 0){
                Q.then(function(ack){callback({OPT_STATUS: constr.OPT.SUCCESS})});
                return;
            }
            var Q2 = new flow.Qpack(flow.serial);
            Q2.then(createMs({
                NAME: 'ISP_'+options.ISP_LCUUID+'_'+options.EPC_ID,
                ISP_LCUUID: options.ISP_LCUUID,
                EPC_ID: options.EPC_ID,
                INTERFACES: []
            }))
            .then(function(data){
                Q.setData('epc_isp_ms', data.LCUUID);
            })
            .then(api.scallTalker('GET', 'v1/instances/', {epc_id: options.EPC_ID}))
            .then(function(ins){
                var vms = ins.VMS.concat(ins.VFWS, ins.LBS);
                vms.forEach(function(vm){
                    vm.INTERFACES.forEach(function(vif){
                        if (vif.IF_TYPE != 'WAN' || vif.WAN.ISP_LCUUID != options.ISP_LCUUID)
                            return;
                        Q2.then(api.scallTalker('POST',
                            'v1/micro-segments/'+Q.getData('epc_isp_ms')+'/interfaces/',
                            {
                                INSTANCE_TYPE: 'VM',
                                INSTANCE_LCUUID: vm.LCUUID,
                                IF_INDEX: vif.IF_INDEX,
                            }
                        ))
                    })
                })
            })
            Q.then(Q2);
        } else {
            Q.setData('epc_isp_ms', ack[0].LCUUID);
            if (options.SERVICES.length == 0){
                Q.then(delDirectChain({
                    EPC_ID: options.EPC_ID,
                    ISP_LCUUID: options.ISP_LCUUID,
                    EPC_ISP_MS_LCUUID: ack[0].LCUUID,
                    ISP_MS_LCUUID: Q.getData('ms_isp')
                }, callback))
                return;
            }
        }
        Q.then(api.scallTalker('GET', 'v1/isps/'+options.ISP_LCUUID, '', function(isp){
            Q.setData('isp', isp.ISP);
        }))
        .then(api.scallTalker('GET', 'v1/ip-resources', '', function(ips){
            ips.some(function(ip){
                if (ip.ISP == Q.getData('isp')){
                    Q.setData('vlantag', ip.VLANTAG);
                    return true;
                }
            })
        }))
        Q.then(function(){
            Q.then(createChain({
                 SRC_MS_LCUUID: Q.getData('ms_isp'),
                 DST_MS_LCUUID: Q.getData('epc_isp_ms'),
                 EPC_ID: options.EPC_ID,
                 ISP_LCUUID: options.ISP_LCUUID,
                 SERVICES: options.SERVICES,
            }))
            if (callback){
                Q.then(function(ack){callback({OPT_STATUS: constr.OPT.SUCCESS})});
            }
        })
    })
    return Q;
}

//options ISP_LCUUID EPC_ID MS_LCUUID
var delDirectChain = function(options, callback){
    var Q = new flow.Qpack(flow.serial);
    var ms_isp, ms_vm_isp;
    Q.then(getMsChain({src_ms_lcuuid: options.ISP_MS_LCUUID, dst_ms_lcuuid: options.EPC_ISP_MS_LCUUID}))
    .then(function(ack){
        if (ack.length){
            Q.then(delChain(ack[0].LCUUID));
            Q.then(delMs(options.EPC_ISP_MS_LCUUID));
        }
        if (callback){
            Q.then(function(ack){
                callback({OPT_STATUS: constr.OPT.SUCCESS})
                return ack;
            })
        }
    })
    return Q;
}



var patchChain = function(){
    //plug all sevice node
    //delete chain
    //create chain
}

module.exports = {
    getChain: getChain,
    createSouthNorthChain: createSouthNorthChain,
    createChain: createChain,
    delChain: delChain,
    delSouthNorthChain: delSouthNorthChain,
    createDirectL3Chain: createDirectL3Chain,
    clearVifMs: clearVifMs,
}
