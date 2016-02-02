var restify = require('restify');
var uuid = require('node-uuid');
var Instance = require('./instance.js');
var Parser = require('./parser.js');
var flow = require('./flow.js');
var logger = require('./logger.js');
var util = require('util');
var Vdc = require('./vdc.js');
var Vpc = require('./vpc.js');
var Vm = require('./vm.js');
var Vfw = require('./vfw.js');
var Vwaf = require('./vwaf.js');
var Vl2 = require('./vl2.js');
var Topo = require('./topo.js');
var Stats = require('./stats.js');
var ThirdHW = require('./third_party_device.js');
var Vgateway = require('./vgateway.js');
var Valve = require('./valve.js');
var pm = require('./pm.js');
var operationLog = require('./operation_log.js');
var atry = require('./mydomain.js')
var Solution = require('./solution.js');
var Epc = require('./epc.js');
var NasStorage = require('./nas_storage.js');
var VulScanner = require('./vul_scanner.js');
var Isp = require('./isp.js');
var Domain = require('./domain.js');
var bunyan = require('bunyan')
var InstanceRole = require('./instance_role.js');
var constr = require('./const.js');
var CloudDisk = require('./cloud_disk.js');
var LB = require('./lb.js');
var Vendor = require('./vendor.js');
var Order = require('./order.js');
var lc_utils = require('./lc_utils.js');
var Order_Services = require('./order_services.js');
var OsTemplate = require('./template_os.js');
var cluster = require('cluster');
var os = require('os');
var Obj = require('./obj.js');
var Order_Charge = require('./order_charge.js');
var Product = require('./product.js');
var instancePot = require('./instancePot.js');
var Vm_Snapshot = require('./vm_snapshot.js');
var Backup = require('./backup.js');
var Pack = require('./pack.js');
var Azure = require('./azure.js');
var Api = require('./api.js');
var ms = require('./ms.js');
//var mtrace = require('mtrace');
//var filename = mtrace.mtrace();
//eonsole.log('Saving mtrace to ' + filename);
//// do stuff
//// // exit program, or, force a flush
//mtrace.gc(); // Optionally force a garbage collect so destructors are called
//mtrace.muntrace();
//// // start tracing again
//mtrace.mtrace();
//
//
//


//
//register the parser with each Instance type
var event_parser_instance = Parser.generateEventParser(Instance)();
var event_parser_instance2 = Parser.generateEventParser(instancePot)();
var url_parser_instance = Parser.generateUrlParser(Instance)();
logger.debug(event_parser_instance);


// the output of app is a STACK of return msg




var auth_checker = function(req, res, next){return next()}



var standard_create = function(type, data, res_return){return function(a, f){
    var operator_name = '';
    if('operator_name' in data){
        operator_name = data.operator_name;
    }
    var p = new flow.serial([
        Instance.create(type, function(data){
                logger.info(a);
                if (data.WAIT_CALLBACK) {
                    delete(data.WAIT_CALLBACK);
                    res_return(data);
                } else {
                    delete(data.WAIT_CALLBACK);
                    res_return(data);
                    p.STD_END();
                }
            },
            function(){
                var a = Array.prototype.splice.call(arguments, 0);
                res_return.apply(this, a);
                p.STD_END();
            }
        ),
        Instance.getObj(
            type,
            function(msg){p.STD_END();},
            'create'
        ),
        Instance.bindEvent(
            'created',
            function(){this.event_handler.created()},
            function(a){
                Instance.clean(a, function(){});
                return function(msg){p.STD_END();}
            }
        ),
        Instance.registerTrigger(
            'created',
            function(){return true},
            event_parser_instance,
            function(a){
                Instance.clean(a, function(){});
                return function(msg){p.STD_END();}
            }
        ),
        Instance.waitFor('created'),
        Instance.clean,
        function(a, f) {
            if ((type=='vm' || type=='lb') && a.data.errno == 0) {
                if (a.data.state == 9) {
                    return standard_action('start')(type, {id:a.data.id,operator_name:operator_name}, function(){})('', f);
                } else if (a.data.state == 4) {
                    var vm = new Vm();
                    return vm['modifyinterface']({id:a.data.id,interfaces:[],operator_name:operator_name},
                                                 function(){f(a)},
                                                 function(){});
                }
            } else if ((type=='vgw' || type=='valve') && a.data.errno == 0) {
                return standard_action('start')(type, {id:a.data.id,operator_name:operator_name}, function(){})('', f);
            } else {
                return f(a);
            }
        },
    ]);
    p.fire(data, function(a){
        if(!p.endFlag){
            logger.info('create done', type, a);
            f(a);
        } else {
            logger.info('create failed');
            f(a);
        };
    });
}
}

var standard_action = function(action){return function(type, data, res_return){
    return function(a, f) {
        var p =new flow.serial([
            Instance.getObj(
                type,
                function(msg){res_return(msg); p.STD_END();}
            ),
            Instance.execute(action)(
                type,
                function(data){
                    logger.info(a);
                    if (data.WAIT_CALLBACK) {
                        delete(data.WAIT_CALLBACK);
                        res_return(data);
                    } else {
                        delete(data.WAIT_CALLBACK);
                        res_return(data);
                        Instance.removeTrigger(action, event_parser_instance)(a, function(){});
                        p.STD_END();
                    }
                },
                function(code, msg){res_return(code, msg); p.STD_END();}
            ),
            Instance.bindEvent(
                action,
                function(){this.event_handler[action]()},
                function(a){
                    Instance.clean(a, function(){});
                    return function(msg){p.STD_END();}
                }
            ),
            Instance.registerTrigger(action, function(){return true}, event_parser_instance),
            Instance.waitFor(action),
            Instance.clean,
            function(a, f){f(a)},
        ]);

        p.fire(data, function(a){logger.info('data of %s %d changed', type, a.data.id); f(a)});
    }
}}

var standard_start = standard_action('start');


/***********************http service************************/
//api version
API_VERSION = 'v1';
API_VERSION_V2 = 'v2';
API_VERSION_V4_1 = 'v4.1';
API_VERSION_V4_2 = 'v4.2';
API_PREFIX = '/' + API_VERSION;
API_PREFIX_V2 = '/' + API_VERSION_V2;
API_PREFIX_V4_1 = '/' + API_VERSION_V4_1;
API_PREFIX_V4_2 = '/' + API_VERSION_V4_2;


//start the api server

    var Event_listener = require('./listener.js');
    var event_listener_instance = Event_listener([event_parser_instance, event_parser_instance2]);
    var server = restify.createServer({
    name : 'test',
    log : bunyan.createLogger({
        name : 'foo',
        level : 'info',
        stream : process.stdout,
    }),
    formatters : {
        'application/json' : function(req, res, body){
            if (body instanceof Error){
                console.log('app---------------------error');
                console.error(body);
                return body.stack;
            } else if (Buffer.isBuffer(body)){
                return body.toString('base64');
            } else{
                return body;
            }
        }
    }
    });
    console.log('worker');
    server.listen(20101, "127.0.0.1", function(){logger.debug('%s listening at %s', server.name, server.url)});

var vml_pack = new Pack();
//setInterval(function(){vml_pack.vmware_learn_timer();}, constr.VMWARE_LEARN_INTERVAL);

/**event handler**/
server.on('NotFound', function(req, res, error, cb){
    res.send(404, 'NotFound');
    res.end();
})

server.on('MethodNotAllowed', function(req, res, error, cb){
    res.send(405, 'MethodNotAllowed');
    res.end();
})

//server.use(auth_checker);
//server.use(url_parser_instance);
server.use(restify.queryParser({mapParams:true}))
server.use(restify.bodyParser({mapParams:false}))
server.pre(restify.pre.sanitizePath())
server.pre(function(req, res, next){
    res.apiuuid = uuid.v4();
    logger.info('REQUEST: apiuuid='+res.apiuuid, req.method, req.url, req.body);
    return next();
})
server.pre(function(req, res, next){
    if (req.headers['appkey'] == constr.APP_KEY){
        return next();
    }
    res.send(401);
    res.end();
})
//parse useruuid to userid
server.use(function(req, res, next){
    if (req.params && req.params.USERUUID){
        Obj.prototype.selectSql(['fdb_user_v2_2', 'useruuid', req.params.USERUUID], function(data){
            req.params.USERID = data[0]['id'];
            logger.info('useruuid '+ req.params.USERUUID+' parse to user '+data[0]['id']);
            delete(req.params.USERUUID);
            next();
        }, function(){
            logger.info('useruuid '+ req.params.USERUUID+' not found');
            next();
        })
    } else if (req.body && req.body.USERUUID){
        Obj.prototype.selectSql(['fdb_user_v2_2', 'useruuid', req.body.USERUUID], function(data){
            req.body.USERID = data[0]['id'];
            logger.info('useruuid '+ req.body.USERUUID+' parse to user '+data[0]['id']);
            delete(req.body.USERUUID);
            next();
        }, function(){
            logger.info('useruuid '+ req.body.USERUUID+' not found');
            next();
        })
    } else if (req.params && req.params.useruuid){
        Obj.prototype.selectSql(['fdb_user_v2_2', 'useruuid', req.params.useruuid], function(data){
            req.params.userid = data[0]['id'];
            logger.info('useruuid '+ req.params.useruuid+' parse to user '+data[0]['id']);
            delete(req.params.useruuid);
            next();
        }, function(){
            logger.info('useruuid '+ req.params.useruuid+' not found');
            next();
        })
    } else if (req.body && req.body.useruuid){
        Obj.prototype.selectSql(['fdb_user_v2_2', 'useruuid', req.body.useruuid], function(data){
            req.body.userid = data[0]['id'];
            logger.info('useruuid '+ req.body.useruuid+' parse to user '+data[0]['id']);
            delete(req.body.useruuid);
            next();
        }, function(){
            logger.info('useruuid '+ req.body.useruuid+' not found');
            next();
        })
    } else{
        return next();
    }
})



var gen_res_return = function(res, next) { return function(a) {
        res.setHeader('content-type', 'application/json');
        if (arguments.length == 2) {
            if (!arguments[1]) {
                arguments[1] = {
                    'OPT_STATUS': "FIXME",
                    'OPT_STATUS_CH': "FIXME: 应答为空",
                    'OPT_STATUS_EN': "FIXME: Empty response"
                };
            } else if (!('OPT_STATUS' in arguments[1])) {
                arguments[1].OPT_STATUS = "FIXME";
                arguments[1].OPT_STATUS_CH = "FIXME: 应答中没有 OPT_STATUS";
                arguments[1].OPT_STATUS_EN = "FIXME: No OPT_STATUS in response";
            } else if (!(arguments[1].OPT_STATUS in constr.OPT_CH) || !(arguments[1].OPT_STATUS in constr.OPT_EN)) {
                arguments[1].OPT_STATUS_CH = "FIXME: OPT_STATUS 没有对应翻译";
                arguments[1].OPT_STATUS_EN = "FIXME: Failed to translate OPT_STATUS";
            } else {
                arguments[1].OPT_STATUS_CH = constr.OPT_CH[arguments[1].OPT_STATUS];
                arguments[1].OPT_STATUS_EN = constr.OPT_EN[arguments[1].OPT_STATUS];
            }
            logger.info('API RES_RETURN: apiuuid='+res.apiuuid, arguments[0], '>', JSON.stringify(arguments[1]));
            res.send(arguments[0], JSON.stringify(arguments[1]));
        } else {
            if (typeof a == 'number') {
                res.send(a, JSON.stringify({
                    'OPT_STATUS': "FIXME",
                    'OPT_STATUS_CH': "FIXME - 应答为空",
                    'OPT_STATUS_EN': "FIXME - Empty response"
                }));
            } else if (!('OPT_STATUS' in a)) {
                a.OPT_STATUS = "FIXME";
                a.OPT_STATUS_CH = "FIXME - 应答中没有 OPT_STATUS";
                a.OPT_STATUS_EN = "FIXME - No OPT_STATUS in response";
                res.send(200, JSON.stringify(a));
            } else if (!(a.OPT_STATUS in constr.OPT_CH) || !(a.OPT_STATUS in constr.OPT_EN)) {
                a.OPT_STATUS_CH = "FIXME - OPT_STATUS 没有对应翻译";
                a.OPT_STATUS_EN = "FIXME - Failed to translate OPT_STATUS";
                res.send(200, JSON.stringify(a));
            } else {
                a.OPT_STATUS_CH = constr.OPT_CH[a.OPT_STATUS];
                a.OPT_STATUS_EN = constr.OPT_EN[a.OPT_STATUS];
                logger.info('API RES_RETURN: apiuuid='+res.apiuuid, 200, JSON.stringify(a));
                res.send(200, JSON.stringify(a));
            }
        }
        res.end();
        return next();
    };
}

var get_authorization_username = function(req){
    var header=req.headers['authorization']||'',        // get the header
    token=header.split(/\s+/).pop()||'',            // and the encoded auth token
    auth=new Buffer(token, 'base64').toString(),    // convert from base64
    parts=auth.split(/:/),                          // split on colon
    username=parts[0];
    //password=parts[1];

   return username;

}


/**
 * @api {post} /v1/solutions Solution Create
 * @apiGroup solution
 * @apiParamExample {json} Request-Example
 *
 * Create Solution
 * {
 *    "DOMAIN": "aae1bc90",
 *    "NAME": "epc-xy",
 *    "USERID": 1,
 *    "ORDER_ID": 1,
 *    "CHARGE_DAYS", 7,
 *    "VGATEWAYS": [
 *          {
 *              "PRODUCT_SPECIFICATION_LCUUID": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *              "NAME": "vgateway-1",
 *              "INTERFACES": [
 *                  {
 *                      "WAN": {
 *                          "ISP": 1,
 *                          "IP_NUM": 1,
 *                          "IP_PRODUCT_SPECIFICATION_LCUUID": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *                          "QOS": {
 *                              "PRODUCT_SPECIFICATION_LCUUID": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *                              "BANDWIDTH": 1048576
 *                          }
 *                      },
 *                  },
 *                  ...
 *                  {
 *                      "LAN": {"VL2_NAME" : "subnet_1"},
 *                  },
 *                  ...
 *          ]},
 *          ...
 *    ],
 *    "VMS": [
 *          {
 *              "PASSWD":"123456",
 *              "NAME":"my-VM",
 *              "OS":"template-centos",
 *              "PRODUCT_SPECIFICATION_LCUUID": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *              "ROLE":"GENERAL_PURPOSE",
 *              "INTERFACES": [
 *                  {
 *                      "WAN": {
 *                          "ISP": 1,
 *                          "IP_NUM": 1,
 *                          "IP_PRODUCT_SPECIFICATION_LCUUID": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *                          "QOS": {
 *                              "PRODUCT_SPECIFICATION_LCUUID": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *                              "BANDWIDTH": 1048576
 *                          }
 *                      },
 *                  },
 *                  ...
 *                  {
 *                      "LAN": {
 *                          "VL2_NAME" : "subnet_1"
 *                      },
 *                  },
 *                  ...
 *              ]
 *          }
 *    ],
 *    "VL2S": [
 *          {"NAME" : "subnet_1"},
 *          {"NAME" : "subnet_2"},
 *          {"NAME" : "subnet_3"}
 *    ]
 * }
 * @apiSuccessExample {json} Success-Response:
 * {
 *    "OPS_STATUS": "SUCCESS",
 *    "DESCRIPTION": "",
 *    "DATA": {
 *        "NAME": "xy-epc",
 *        "EPC_ID": 123
 *    }
 * }
 */


var solution_create = server.post(API_PREFIX + '/solutions', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var solution = new Solution();
        solution.create(data, standard_create, standard_action, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


/**
 * @api {post} /v1/epcs Epc Create
 * @apiDescription 创建EPC，一个租户可以创建多个EPC，一个EPC对应租户的一个私有云
 * @apiGroup EPC
 * @apiParamExample {json} Request-Example
 *
 * Create Epc
 * {
 *      "name": "my-epc",
 *      "userid": 2,
 *      "domain": "69db0108-3aaa-4ae8-8e82-ca876345e14e",
 *      "order_id": 3
 * }
 */
//create epc
server.post(API_PREFIX + '/epcs', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var epc = new Epc();
        epc.create(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


/**
 * @api {patch} /v1/epcs/<id> Epc Modify
 * @apiGroup EPC
 * @apiParamExample {json} Request-Example
 *
 * {
 *      "name": "my-epc",
 *      "userid": 2,
 * }
 */
//modify epc
server.patch(API_PREFIX + '/epcs/:id', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.params.id;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var epc = new Epc();
        epc.update(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


/**
 * @api {delete} /v1/epcs/<id> Epc Delete
 * @apiGroup EPC
 * @apiDescription Delete Epc
 */
//delete epc
server.del(API_PREFIX + '/epcs/:id', function (req, res, next){
    logger.debug('delete target is epc', req.params);
    var data = {id:req.params.id, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var epc = new Epc();
        epc.delete(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get epcs
server.get(API_PREFIX + '/epcs', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var epc = new Epc();
        epc.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.get(API_PREFIX + '/epcs/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var epc = new Epc();
        epc.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


//get vms
server.get(API_PREFIX + '/vms', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vm
server.get(API_PREFIX + '/vms/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /v1/vms  VM Create
 * @apiGroup VM
 * @apiParamExample {json} Request-Example
 *
 * Create VM
 * {
 *     "allocation_type": "manual",
 *     "userid": 2,
 *     "order_id": 1,
 *     "passwd": "123456",
 *     "name": "test",
 *     "os": "template-centos",
 *     "pool_lcuuid": "a8a3b4f2-478e-4875-9f4d-a3a76afe23d6",
 *     "launch_server": "172.16.1.111",
 *     "product_specification_lcuuid": "302d2f8e-0a89-42b4-8b1c-4933582082a7",
 *     "vcpu_num": 1,
 *     "mem_size": 1024,
 *     "sys_disk_size": 30,
 *     "user_disk_size": 10,
 *     "role": "GENERAL_PURPOSE"
 * }
 */
//create vm
server.post(API_PREFIX + '/vms', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    data.type = 'vm';
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_create('vm', data, res_return)('', function(){logger.info('vm create end')});
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {patch} /v1/vms/:id VM Operation
 * @apiDescription 修改虚拟机信息，包括开关机、设置所属EPC、修改虚拟机CPU/内存规格、
 * 接口组网、接口解除组网、网络隔离、网络恢复、快照、回滚等操作。
 * @apiGroup VM
 * @apiParamExample {json} Request-Example
 *
 * Start VM
 * {
 *     "action": "start"
 * }
 *
 * Stop VM
 * {
 *     "action": "stop"
 * }
 *
 * Set VM EPC
 * {
 *     "action": "setepc",
 *     "epc_id": 1
 * }
 *
 * Modify VM Name
 * {
 *     "action": "modify",
 *     "name": "test"
 * }
 *
 * Modify VM Specification
 * {
 *     "action": "modify",
 *     "vcpu_num": 1,
 *     "mem_size": 1024,
 *     "sys_disk_size": 30,
 *     "user_disk_size": 10,
 *     "product_specification_lcuuid": "75233f1e-54e6-473b-a715-c241385af4fc"
 * }
 *
 * Modify VM Network Configure：注意虚拟机只有设置EPC后才能组网
 * {
 *     "action": "modifyinterface",
 *     "gateway": "192.168.0.1",
 *     "loopback_ips": [],
 *     "interfaces": [
 *         {
 *             "state": "1: ATTACH, 2: DETACH",
 *             "state": 1,
 *             "if_type": "1: CONTROL, 2: SERVICE, 3: WAN, 4: LAN",
 *             "if_index": 0,
 *             "wan": {
 *                 "ips": [{"ip_resource_lcuuid": "30730a89-89a8-47d1-b84d-183d9389488f"}],
 *                 "qos": {
 *                     "min_bandwidth": 104857600,
 *                     "max_bandwidth": 104857600
 *                  }
 *             }
 *             "lan": "和wan不可共存",
 *             "lan": {
 *                 "vl2_lcuuid": "a8a3b4f2-478e-4875-9f4d-a3a76afe23d6",
 *                 "ips": [
 *                     {
 *                         "vl2_net_index": 1,
 *                         "address": "1.1.1.1"
 *                     }
 *                 ],
 *                 "qos": {
 *                     "min_bandwidth": 1024,
 *                     "max_bandwidth": 2048
 *                 }
 *             }
 *         }
 *     ]
 * }
 *
 * Isolate VM：隔离虚拟机的所有网络连接，仅开放TCP 22和TCP
 * 3389用于租户登陆进行异常排查
 * {
 *     "action": "isolate"
 * }
 *
 * Reconnect VM：恢复虚拟机的所有网络连接
 * {
 *     "action": "reconnect"
 * }
 *
 * Create VM Snapshots
 * {
 *     "action": "snapshot"
 * }
 *
 * Delete VM Snapshots
 * {
 *     "action": "delsnapshot"
 * }
 *
 * Revert VM Snapshots
 * {
 *     "action": "recoversnapshot"
 * }
 */
//update vm
server.patch(API_PREFIX + '/vms/:id', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.params.id;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    var vm = new Vm();
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    flow_steps.push(function(a, f) {
        vm.selectSql(
            [vm.tableName, 'id', data.id],
            function(vms) {
                if (vms.length > 0) {
                    var vm_state = parseInt(vms[0].state);
                    if(vm_state == 4 || vm_state == 9){
                        f(vms[0].lcuuid);
                    }else{
                        res_return(404, {OPT_STATUS: constr.OPT.RESOURCE_OPTION_PROHIBITED, DESCRIPTION: constr.OPT_CH.RESOURCE_OPTION_PROHIBITED});
                        app.STD_END();
                    }
                } else {
                    res_return(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: 'vm is not found'});
                    app.STD_END();
                }
            },
            function(){
                res_return(500, {OPT_STATUS: constr.OPT.DB_QUERY_ERROR, DESCRIPTION: 'query vm error'});
                app.STD_END();
            }
        );
    });

    flow_steps.push(function(a, f) {
        vm.sendData('/v1/vms/'+ a + '/snapshots', 'get', '',
            function(sCode, resp){
                if ('DATA' in resp && 'SNAPSHOTS' in resp.DATA && resp.DATA.SNAPSHOTS.length){
                    if (resp.DATA.SNAPSHOTS[0].STATE == 'REVERTING') {
                        res_return(404, {OPT_STATUS: constr.OPT.OP_PROHIBITED_WHEN_REVERTING,
                                         DESCRIPTION: 'vm is reverting'});
                        app.STD_END();
                    }
                }
                f(a);
            },
            function(){
                res_return(500, {OPT_STATUS: constr.OPT.SERVER_ERROR, DESCRIPTION: 'get snapshot api error'});
                app.STD_END();
            }
        )
    });
    flow_steps.push(function(a, f){
    atry(function(){
        if ('action' in data){
            if (['modify', 'recreate', 'modifyvdisk', 'start', 'stop', 'snapshot', 'delsnapshot'].indexOf(data.action) > -1){
                standard_action(data.action)('vm', data, res_return)('', function(){logger.info('vm '+data.action+' end')});
            } else if (['isolate', 'reconnect', 'setepc'].indexOf(data.action) > -1){
                vm.setData(data);
                vm[data.action](data, res_return, res_return);
            } else if (['modifyinterface'].indexOf(data.action) > -1) {
                vm[data.action](data, res_return, res_return);
            } else if (['recoversnapshot'].indexOf(data.action) > -1) {
                vm.revert(data, standard_action, res_return, res_return);
            } else {
                res_return(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA,DESCRIPTION: 'post not found request action'});
            }
        } else{
            res_return(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA,DESCRIPTION: 'post not found action'});
        }
    }).catch(function(err){logger.error(err)});
    })
    app.fire('', function(){});
});

//Start charge vm
server.post(API_PREFIX + '/charges/vms/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//Start charge vwaf
server.post(API_PREFIX + '/charges/vwafs/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vwaf = new Vwaf();
        vwaf.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})
//get snapshots
server.get(API_PREFIX + '/snapshots', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.get_snapshot(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get snapshot
server.get(API_PREFIX + '/snapshots/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.get_snapshot(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//Start charge snapshot
server.post(API_PREFIX + '/charges/snapshots/:lcuuid/', function(req, res, next){
    var data = {lcuuid:req.params.lcuuid};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.start_snapshot_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//Attach/Detach vm vinterface
server.put(API_PREFIX + '/vms/:id/interfaces/:ifindex', function(req, res, next){
    var data = req.body;
    data.id = req.params.id;
    data.ifindex = req.params.ifindex;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.putinterface(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

server.patch(API_PREFIX + '/vdisks', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.body.vmid;
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        if ('action' in data){
            if (['modifyvdisk', 'delvdisk', 'unplugvdisk', 'plugvdisk'].indexOf(data.action) > -1){
                standard_action(data.action)('vdisk', data, res_return)('', function(){logger.info('vm '+data.action+' end')});
            } else{
                res_return(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA,DESCRIPTION: 'post not found request action'});
            }
        }else{
            res_return(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA,DESCRIPTION: 'post not found action'});
        }
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {delete} /v1/vms/:id  VM Delete
 * @apiGroup VM
 * @apiDescription Delete VM
 */
//delete vm
server.del(API_PREFIX + '/vms/:id', function(req, res, next){
    logger.debug('delete target is vm', req.params);
    var data = {id:req.params.id, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.selectSql(
            [vm.tableName, 'id', data.id],
            function(vms) {
                if (vms.length > 0) {
                    if (vms[0].state == 0 && vms[0].errno == 851968 ) {
                        /* tmp state */
                        vm.del(data, res_return, res_return);
                        vm.deleteSql([vm.tableName, 'id', data.id],function() {res_return(200, {OPT_STATUS: 'SUCCESS'});},res_return);
                    } else {
                        standard_action('del')('vm', data, res_return)('', function(){logger.info('vm delete end')});
                    }
                } else {
                    res_return(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,DESCRIPTION: 'vm is not found'});
                }
            },res_return);
    }).catch(function(err){logger.error(err)});
});

//delete vgw
server.del(API_PREFIX + '/vgws/:id', function(req, res, next){
    logger.debug('delete target is vgw', req.params);
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_action('del')('vgw', data, res_return)('', function(){logger.info('vgw delete end')})
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /v1/vl2s  VL2 Create
 * @apiDescription 创建一个VL2，即租户的Private Network，
 * 一个VL2可以指定多个nets，对应Private Network中的多个Subnet
 * @apiGroup VL2
 * @apiParamExample {json} Request-Example
 *
 * Create VL2
 * {
 *     "name": "subnet1",
 *     "epc_id": 1,
 *     "userid": 2,
 *     "vlantag": 0,
 *     "domain": "396a40e9-749d-4949-99d2-32f582145d44",
 *     "nets": [
 *          {
 *              "prefix": "192.168.0.0",
 *              "netmask": 16
 *          }
 *      ]
 * }
 */
//create vl2
server.post(API_PREFIX + '/vl2s', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_create('vl2', data, res_return)('', function(){logger.info('vl2s creation end')});
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {patch} /v1/vl2s/:id  VL2 Operation
 * @apiDescription 修改VL2的Subnet和name，注意此API对nets的操作为全量更新，
 * 如果有设备正在使用该Subnet将导致更新失败。
 * @apiGroup VL2
 * @apiParamExample {json} Request-Example
 *
 * Modify VL2
 * {
 *     "name": "my-vl2",
 *     "nets": [
 *          {
 *              "prefix": "192.168.0.0",
 *              "netmask": 16
 *          }
 *      ]
 * }
 */
//update vl2
server.patch(API_PREFIX + '/vl2s/:id', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.params.id;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vl2 = new Vl2();
        vl2.update(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {delete} /v1/vl2s/:id  VL2 Delete
 * @apiGroup VL2
 * @apiDescription Delete VL2
 */
//delete vl2
server.del(API_PREFIX + '/vl2s/:id', function(req, res, next){
    logger.debug('delete target is vl2', req.params);
    var data = {id:req.params.id, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vl2 = new Vl2();
        vl2.del(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /v1/vl2s/:id VL2 Get
 * @apiGroup VL2
 * @apiDescription Get VL2
 */
//get vl2
server.get(API_PREFIX + '/vl2s/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vl2 = new Vl2();
        vl2.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /v1/vl2s VL2 Get
 * @apiGroup VL2
 * @apiParam {Number} [userid] 根据租户过滤
 * @apiParam {Number} [epc_id] 根据EPC过滤
 * @apiParam {String} [domain] 根据domain uuid过滤
 */
server.get(API_PREFIX + '/vl2s', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vl2 = new Vl2();
        vl2.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /v1/topologies/:epc_id GET EPC topology
 * @apiDescription 获取租户EPC的逻辑拓扑
 * @apiGroup EPC
 * @apiParam {Boolean} smart 设置为true时返回逻辑拓扑的层级式结构，
 * 否则返回网络连接关系列表。
 */
server.get(API_PREFIX + '/topologies/:epc_id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var topo = new Topo();
        topo.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//create vpc
server.post(API_PREFIX + '/vpcs', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vpc = new Vpc();
        vpc.create(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.post(API_PREFIX + '/operation-logs', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    var res_return = gen_res_return(res, next);
    atry(function(){
        operationLog.create_and_update(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//update pm deploy finash
server.post(API_PREFIX + '/pm_deploy_state/:pmip', function(req, res, next){
   logger.debug('pmip', req.params.pmip);
   var data = {ip:req.params.pmip};
   var res_return = gen_res_return(res, next);
   atry(function(){
       var pmjs = new pm();
       pmjs.mdf_deploy_job(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {patch} /v1/third-party-devices/:thirdhw_id/interfaces/:if_index Modify hardware device network
 * @apiDescription 修改硬件设备组网
 * @apiGroup bare metal
 */
server.patch(API_PREFIX + '/third-party-devices/:thirdhw_id/interfaces/:if_index', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.params.thirdhw_id;
    data.if_index = req.params.if_index;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        if ('state' in data){
            if ( data.state == 1) {
                standard_action('attach')('thirdhw', data, res_return)('', function(){logger.info('thirdhw '+data.action+' end')});
            } else {
                standard_action('detach')('thirdhw', data, res_return)('', function(){logger.info('thirdhw '+data.action+' end')});
            }
        }
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {patch} /v1/third-party-devices/:thirdhw_id Modify hardware device info
 * @apiDescription 修改硬件设备EPC或Name
 * @apiGroup bare metal
 * @apiParamExample {json} Url-Example
 * Set EPC
 * {
 *      epc_id: 1,
 *      domain: xxx-xxxx,
 * }
 * Change Name
 * {
 *      name: 'test'
 * }
 */
server.patch(API_PREFIX + '/third-party-devices/:thirdhw_id', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.params.thirdhw_id;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        if ("epc_id" in data){
            var thirdhw = new ThirdHW();
            //standard_action('setepc')('thirdhw', data, res_return)('', function(){logger.info('thirdhw '+data.action+' end')});
            thirdhw.setepc(data, res_return, res_return);
        } else {
            var thirdhw = new ThirdHW();
            standard_action('updateintf')('thirdhw', data, res_return)('', function(){logger.info('thirdhw '+data.action+' end')});
        }
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {patch} /v4.1/third-party-devices/<lcuuid> Modify hardware device info
 * @apiVersion 4.1.0
 * @apiDescription 修改硬件设备EPC或Name
 * @apiGroup bare metal
 * @apiParamExample {json} Url-Example
 * Set EPC
 * {
 *      epc_id: 1,
 *      domain: xxx-xxxx,
 * }
 * Change Name
 * {
 *      name: 'test'
 * }
 *
 */
server.patch(API_PREFIX_V4_1 + '/third-party-devices/:lcuuid', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        if ('epc_id' in data || 'name' in data){
            var thirdhw = new ThirdHW();
            thirdhw.setepc(data, res_return, res_return);
        } else {
            var thirdhw = new ThirdHW();
            standard_action('updateintf')('thirdhw', data, res_return)('', function(){logger.info('thirdhw '+data.action+' end')});
        }
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /third-party-devices/ Get bare metals
 * @apiVersion 4.0.0
 * @apiGroup bare metal
 * @apiParamExample Url-Example
 * /third-party-devices/
 */
server.get(API_PREFIX + '/third-party-devices', function(req, res, next){
    logger.debug('request thirdhws');
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var thirdhw = new ThirdHW();
        thirdhw.get_thirdhws(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /third-party-devices/<id> Get bare metal
 * @apiVersion 4.0.0
 * @apiGroup bare metal
 * @apiParam {INT} id bare metal id
 * @apiParamExample Url-Example
 * /third-party-devices/3
 */
server.get(API_PREFIX + '/third-party-devices/:thirdhw_id', function(req, res, next){
    logger.info('request thirdhws id=', req.params.thirdhw_id);
    var data = req.params;
    data.id = data.thirdhw_id;
    delete data["thirdhw_id"];
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var thirdhw = new ThirdHW();
        thirdhw.get_thirdhws(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /v4.1/third-party-devices/<lcuuid> Get bare metal
 * @apiVersion 4.1.0
 * @apiGroup bare metal
 * @apiParam {UUID} lcuuid bare metal lcuuid
 * @apiParamExample Url-Example
 * /third-party-devices/f06d6d6a-d061-4814-beb2-936bb4aec9cb
 */
server.get(API_PREFIX_V4_1 + '/third-party-devices/:lcuuid', function(req, res, next){
    logger.info('request thirdhws lcuuid=', req.params.lcuuid);
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var thirdhw = new ThirdHW();
        thirdhw.get_thirdhws(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /v4.1/third-party-devices/order/ buy bm
 * @apiVersion 4.1.0
 * @apiGroup bare metal
 * @apiParamExample Url-Example
 * {
 *   "USERID": 2,
 *   "ORDER_ID": 82,
 *   "PRODUCT_SPECIFICATION_LCUUID": "9b6221e6-5377-11e4-a09e-de1f0560b5d0",
 *   "DOMAIN": "9b6221e6-5377-11e4-a09e-de1f0560b5d9",
 *   "RAID": 10,
 *   "OS": "CentOS7.0-x86_64",
 *   "INIT_PASSWD": "H3110_W0r1d",
 *   "BOOTIF_NAME": "em1",
 *   "BUILDIN_AGENT": true,
 *   "PARTITIONS": [
 *       {
 *           "FSPATH": "/home",
 *           "FSTYPE": "ext2",
 *           "SIZE": 4096
 *       },
 *       {
 *           "FSPATH": "/var",
 *           "FSTYPE": "ext3",
 *           "SIZE": 2048
 *       },
 *       {
 *           "FSPATH": "/tmp",
 *           "SIZE": 1024
 *       }
 *   ]
 * }
 */
server.post(API_PREFIX_V4_1 + '/third-party-devices/order', function(req, res, next){
    var data = req.body;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var hw = new ThirdHW();
        var Q = new flow.Qpack(flow.serial);
        var operator_name = get_authorization_username(req);
        Q.setData('operatorName', operator_name);
        Q.then(hw.buyHW(data, res_return))
        .resolve('', logger.info);
    }).catch(function(err){logger.error(err)})
})

/**
 * @api {post} /third-party-devices/<lcuuid>/os/ install os
 * @apiVersion 4.1.0
 * @apiGroup bare metal
 * @apiParam {UUID} lcuuid bare metal lcuuid
 * @apiParamExample Url-Example
 * {
 *   "RAID": 10,
 *   "OS": "CentOS7.0-x86_64",
 *   "INIT_PASSWD": "H3110_W0r1d",
 *   "BOOTIF_NAME": "em1",
 *   "BUILDIN_AGENT": true,
 *   "PARTITIONS": [
 *       {
 *           "FSPATH": "/home",
 *           "FSTYPE": "ext2",
 *           "SIZE": 4096
 *       },
 *       {
 *           "FSPATH": "/var",
 *           "FSTYPE": "ext3",
 *           "SIZE": 2048
 *       },
 *       {
 *           "FSPATH": "/tmp",
 *           "SIZE": 1024
 *       }
 *   ]
 * }
 */
server.post(API_PREFIX_V4_1 + '/third-party-devices/:lcuuid/os', function(req, res, next){
    logger.info('request thirdhws lcuuid=', req.params.lcuuid);
    var data = req.body;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var hw = new ThirdHW();
        var Q = new flow.Qpack(flow.serial);
        var operator_name = get_authorization_username(req);
        Q.setData('operatorName', operator_name);
        Q.then(hw.installOS(req.params.lcuuid, data, res_return))
        .resolve('', logger.info);
    }).catch(function(err){logger.error(err)})
})

server.get(API_PREFIX + '/live-connectors', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    logger.info(data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var thirdhw = new ThirdHW();
        thirdhw.get_live_connectors(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


//Start charge thirdhw
server.post(API_PREFIX + '/charges/third-party-devices/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var thirdhw = new ThirdHW();
        thirdhw.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})


/**
 * @api {post} /vgateways/ VGateway Create
 * @apiDescription 创建虚拟网关
 * @apiVersion 3.4.0
 * @apiGroup vgateway
 * @apiParam {Number} USERID Users unique ID
 * @apiParam {Number} ORDER_ID Order unique ID
 * @apiParam {String{1..20}} NAME The vgateway name
 * @apiParam {String} ALLOCATION_TYPE Create mode
 * @apiParam {String} GW_POOL_LCUUID Gateway pool lcuuid
 * @apiParam {String} GW_LAUNCH_SERVER The gateway server IP address
 * @apiParam {String} DOMAIN Domain lcuuid
 * @apiParam {String} PRODUCT_SPECIFICATION_LCUUID Product specification lcuuid
 * @apiParamExample {json} Request-Example
 *
 * Create VGateway（手动分配宿主机）
 * {
 *     "ALLOCATION_TYPE":"MANUAL",
 *     "USERID":2,
 *     "OEDER_ID":1,
 *     "NAME":"my-gateway",
 *     "DOMAIN": "AAAAAA",
 *     "GW_POOL_LCUUID":"9b6221e6-5377-11e4-a09e-de1f0560b5d9",
 *     "GW_LAUNCH_SERVER":"172.16.1.111",
 *     "PRODUCT_SPECIFICATION_LCUUID": "vGateway产品规格，例如：1个WAN口、3个LAN口、千兆等",
 *     "PRODUCT_SPECIFICATION_LCUUID": "9b6221e6-5377-11e4-a09e-de1f0560b5d0"
 * }
 *
 * Create VGateway（自动分配宿主机）
 * {
 *     "ALLOCATION_TYPE":"AUTO",
 *     "USERID":2,
 *     "OEDER_ID":1,
 *     "NAME":"my-gateway",
 *     "DOMAIN": "AAAAAA",
 *     "PRODUCT_SPECIFICATION_LCUUID": "9b6221e6-5377-11e4-a09e-de1f0560b5d0"
 * }
 */
server.post(API_PREFIX + '/vgateways', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_create('vgateway', data, res_return)('', function(){logger.info('vgateway create end')});
    }).catch(function(err){logger.error(err)});
});

//start charge vgateway
server.post(API_PREFIX + '/charges/vgateways/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vgateway = new Vgateway();
        vgateway.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//delete vgateway
/**
 * @api {delete} /vgateways/:id VGateway Delete
 * @apiVersion 3.4.0
 * @apiGroup vgateway
 * @apiParam {Number} ID Vgateways unique ID
 * @apiSuccessExample {json} Success-Response:
 * {
 *     "DESCRIPTION":"",
 *     "OPT_STATUS":"SUCCESS",
 * }
 */

server.del(API_PREFIX + '/vgateways/:id', function(req, res, next){
    logger.debug('delete target is vgateway', req.params);
    var data = {id:req.params.id, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_action('del')('vgateway', data, res_return)('', function(){logger.info('vgateway delete end')})
    }).catch(function(err){logger.error(err)});
});

//get vgateway
/**
 * @api {get} /vgateways/:id VGateway Get
 * @apiVersion 3.4.0
 * @apiGroup vgateway
 * @apiParam {Number} ID Vgateways unique ID
 * @apiSuccessExample {json} Success-Response:
 * {
 *     "TYPE":"VGATEWAY",
 *     "DATA":{
 *     "LCUUID": "9b6221e6-5377-11e4-a09e-de1f0560b5d0",
 *     "USERID":2,
 *     "NAME":"my-gateway",
 *     "ERRNO":0,
 *     "DOMAIN": "9b6221e6-5377-11e4-a09e-de1f0560b5da",
 *     "GW_POOL_LCUUID":"9b6221e6-5377-11e4-a09e-de1f0560b5db",
 *     "GW_LAUNCH_SERVER":"172.16.1.111",
 *     "INTERFACES": [
 *     {
 *         "IF_INDEX": "WAN口从1到8，LAN口从10到40",
 *         "IF_INDEX": 1,
 *         "STATE": 1,
 *         "IF_TYPE": "公网WAN、私网LAN（用户自定义子网，报告管理子网）",
 *         "IF_TYPE": "WAN",
 *         "WAN": {
 *             "IPS": [
 *               { "IP_RESOURCE_LCUUID": "aaaaaaaaa" }
 *             ],
 *            "QOS": { "MIN_BANDWIDTH": 2097152, "MAX_BANDWIDTH": 2097152 }
 *         },
 *         "LAN": NULL
 *     },
 *     {
 *         "IF_INDEX": 2,
 *         "STATE": 2,
 *     }, ...
 *     {
 *         "IF_INDEX": "WAN口从1到8，LAN口从10到40",
 *         "IF_INDEX": 10,
 *         "STATE": 1,
 *         "IF_TYPE": "公网WAN、私网LAN（用户自定义子网，报告管理子网）",
 *         "IF_TYPE": "LAN",
 *         "LAN": "不同的LAN INTERFACE不能在同一个VL2中",
 *         "LAN": {
 *             "VL2_LCUUID": "aaaaaaaaaaaaaaaaaaaaaaaaa",
 *             "IPS": [
 *                { "VL2_NET_INDEX": 1, "ADDRESS": "10.20.30.1" }
 *             ],
 *             "QOS": { "MIN_BANDWIDTH": 0, "MAX_BANDWIDTH": 0 }
 *         },
 *         "WAN": NULL
 *     },
 *     {
 *         "IF_INDEX": 11,
 *         "STATE": 2,
 *     }]},
 *     "DESCRIPTION":"",
 *     "OPT_STATUS":"SUCCESS"
 * }
 */

server.get(API_PREFIX + '/vgateways/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vgateway = new Vgateway();
        vgateway.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});
/**
 * @api {get} /vgateways VGateway Get
 * @apiVersion 3.4.0
 * @apiGroup vgateway
 * @apiParam {Number} page_size The page size
 * @apiParam {Number} page_index The page number
 * @apiParam {Number} userid User unique ID
 * @apiParamExample Url-Example
 * /vgateways/?page_size=10&page_index=1&userid=2
 * @apiSuccessExample {json} Success-Response:
 * {
 *     "DESCRIPTION":"",
 *     "TYPE":"VGATEWAY",
 *     "WAIT_CALLBACK":false,
 *     "DATA":[{
 *         "LCUUID":"c0263487-93e7-46d1-8792-1c872e72aa48",
 *         "PRODUCT_SPECIFICATION_LCUUID":"bf384fe4-9cb0-4b18-9324-629a13a89038",
 *         "DOMAIN":"df9f8151-2153-4612-a43c-92bee15944e2",
 *         "NAME":"router-39-1",
 *         "GW_POOL_LCUUID":"5e0b3cdd-3b69-4880-b622-2ca323f34a44",
 *         "ERRNO":0,
 *         "INTERFACES":[
 *             {"WAN":{
 *                 "IPS":[{
 *                     "IP_RESOURCE_LCUUID":"a39f56d3-6634-4503-8a79-84aa665b760a",
 *                     "IP_RESOURCE":{
 *                         "IN_USE":true,
 *                         "IP_RESOURCE_LCUUID":"a39f56d3-6634-4503-8a79-84aa665b760a",
 *                         "IP":"192.168.23.201",
 *                         "NETMASK":16,
 *                         "GATEWAY":"192.168.0.1",
 *                         "POOLID":0,
 *                         "ORDER_ID":36,
 *                         "USERID":3,
 *                         "DOMAIN":"df9f8151-2153-4612-a43c-92bee15944e2",
 *                         "ISP":1,
 *                         "VLANTAG":0,
 *                         "PRODUCT_SPECIFICATION_LCUUID":"355326b8-f1f6-4ae6-abb0-0c98d53a01c7",
 *                         "USER":{"ID":3,"USERNAME":"username","STATE":1},
 *                         "DOMAIN_INFO":{"LCUUID":"df9f8151-2153-4612-a43c-92bee15944e2","DOMAINNAME":"xq_domain"}
 *                     }}
 *                  ],
 *                 "QOS":{"MAX_BANDWIDTH":1048576,"MIN_BANDWIDTH":1048576}
 *                 },
 *                 "STATE":1,
 *                 "IF_INDEX":1,
 *                 "IF_TYPE":"WAN"
 *             },{
 *                 "STATE":1,
 *                 "IF_INDEX":10,
 *                 "LAN":{
 *                     "IPS":[{"VL2_NET_INDEX":1,"ADDRESS":"2.2.2.2"}],
 *                     "VL2_LCUUID":"89b508fc-e640-42dc-abdc-68fded19ae58",
 *                     "QOS":{"MAX_BANDWIDTH":1048576000,"MIN_BANDWIDTH":1048576000},
 *                     "VLANTAG":null,
 *                     "VL2":{
 *                         "LCUUID":"89b508fc-e640-42dc-abdc-68fded19ae58",
 *                         "DOMAIN":"df9f8151-2153-4612-a43c-92bee15944e2",
 *                         "NAME":"vxnet2",
 *                         "USERID":3,
 *                         "STATE":2,
 *                         "NETS":[{
 *                             "LCUUID":"74bb4450-ca00-41dd-b9d2-4c30d0aeda69",
 *                             "NET_INDEX":1,
 *                             "DOMAIN":"df9f8151-2153-4612-a43c-92bee15944e2",
 *                             "PREFIX":"2.2.2.0",
 *                             "NETMASK":24}
 *                          ],
 *                          "VLANTAG":0,
 *                          "ID":5
 *                      }
 *                 },
 *                 "IF_TYPE":"LAN"
 *      }],
 *     "USERID":3,
 *     "GW_LAUNCH_SERVER":"172.16.1.120",
 *     "EPC_ID":2,
 *     "STATE":7,
 *     "ROLE":7,
 *     "RATE":1048576000,
 *     "ID":17,
 *         "CREATE_TIME":"2015-02-25 11:08:16",
 *         "USER":{"ID":3,"USERNAME":"xiaofeng","STATE":1},
 *         "EPC":{"ID":2,"EPCNAME":"xq_domain-xiaofeng"},
 *         "DOMAIN_INFO":{"LCUUID":"df9f8151-2153-4612-a43c-92bee15944e2","DOMAINNAME":"xq_domain"}
 *     },...],
 *     "PAGE":{
 *         "INDEX":1,
 *         "TOTAL":1,
 *         "SIZE":10
 *     },
 *     "OPT_STATUS":"SUCCESS",
 *     "OPT_STATUS_CH":"",
 *     "OPT_STATUS_EN":""
 * }
 */

server.get(API_PREFIX + '/vgateways', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vgateway = new Vgateway();
        vgateway.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//update vgateway
/**
 * @api {patch} /vgateways/:id VGateway Operation
 * @apiDescription 修改虚拟网关名称、组网
 * @apiVersion 3.4.0
 * @apiGroup vgateway
 * @apiParamExample {json} Request-Example
 * Modify VGateay Name
 * {
 *     NAME:"new-name"
 * }
 *
 * Mofigy VGateway Network
 * {
 *     "DATA": [
 *         {
 *             "IF_INDEX": "WAN口从1到8，LAN口从10到40",
 *             "IF_INDEX": 1,
 *             "STATE": 1,
 *             "IF_TYPE": "公网WAN、私网LAN（用户自定义子网，报告管理子网）",
 *             "IF_TYPE": "WAN",
 *             "WAN": {
 *                 "IPS": [{ "IP_RESOURCE_LCUUID": "aaaaaaaaa" },...],
 *                 "QOS": { "MIN_BANDWIDTH": 2097152, "MAX_BANDWIDTH": 2097152 }
 *             },
 *             "LAN": NULL
 *         },
 *         {
 *             "IF_INDEX": 2,
 *             "STATE": 2,
 *         }, ...
 *         {
 *             "IF_INDEX": "WAN口从1到8，LAN口从10到40",
 *             "IF_INDEX": 10,
 *             "STATE": 1,
 *             "IF_TYPE": "公网WAN、私网LAN（用户自定义子网，报告管理子网）",
 *             "IF_TYPE": "LAN",
 *             "LAN": "不同的LAN INTERFACE不能在同一个VL2中",
 *             "LAN": {
 *                 "VL2_LCUUID": "aaaaaaaaaaaaaaaaaaaaaaaaa",
 *                 "IPS": [
 *                    { "VL2_NET_INDEX": 1, "ADDRESS": "10.20.30.1" }
 *                 ],
 *                 "QOS": { "MIN_BANDWIDTH": 0, "MAX_BANDWIDTH": 0 }
 *             },
 *             "WAN": NULL
 *         },
 *         {
 *             "IF_INDEX": 11,
 *             "STATE": 2,
 *         }
 *     ]
 * }
 */

server.patch(API_PREFIX + '/vgateways/:id', function(req, res, next){
    logger.info('request body is', req.body);
    var data = req.body;
    data.id = req.params.id;
    logger.debug('request req.params.id is:', req.params.id);
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        if ('epc_id' in data) {
            var vgateway = new Vgateway();
            vgateway.setepc(data, res_return, res_return);
        }else if ('name' in data) {
            var vgateway = new Vgateway();
            vgateway.modify_vgw_name(data, res_return, res_return);
        } else {
            standard_action('update')('vgateway', data, res_return)('', function(){logger.info('vgateway update end')});
        }
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {put} /v1/vgateways/<vgateway_lcuuid>/config/ VGateway管理
 * @apiDescription 虚拟网关策略配置：Input ACL, Forward ACL, SNAT, DNAT, IPSec VPN, Route
 * @apiVersion 3.4.0
 * @apiGroup vgateway
 * @apiParamExample {json} Request-Example
 *
 * Input ACL
 *
 * {"DATA": [
 * {
 *      "NAME": "my-input-acl-1",
 *      "RULE_ID": 1,
 *      "STATE": "0: disabled, 1: enabled"
 *      "STATE": 1
 *      "ISP": "必填",
 *      "ISP": 1,
 *      "PROTOCOL": "表示IP协议类型的数字：http://en.wikipedia.org/wiki/List_of_IP_protocol_numbers，常用：TCP(6), UDP(17)",
 *      "PROTOCOL": 6,
 *      "MATCH_SRC": {
 *          "IF_INDEX": "必填，流量进入vGateway的接口，只能只WAN口",
 *          "IF_INDEX": 1,
 *          "MIN_ADDRESS": "10.20.30.128",
 *          "MAX_ADDRESS": "10.20.30.255",
 *          "MIN_PORT": 12345,
 *          "MAX_PORT": 23456
 *      },
 *      "MATCH_DST": {
 *          "MIN_ADDRESS": "10.20.30.128",
 *          "MAX_ADDRESS": "10.20.30.255",
 *          "MIN_PORT": 20000,
 *          "MAX_PORT": 50000
 *      },
 *      "ACTION": "ACCEPT、DROP",
 *      "ACTION": "ACCEPT"
 * },
 * ...
 * ]}
 *
 * Forward ACL
 *
 * {"DATA": [
 *      {
 *          "NAME": "my-forward-acl-1",
 *          "RULE_ID": 1,
 *          "STATE": "0: disabled, 1: enabled"
 *          "STATE": 1
 *          "ISP": "必填",
 *          "ISP": 1,
 *          "PROTOCOL": 6,
 *          "MATCH_SRC": {
 *              "IF_INDEX": 100,
 *              "MIN_ADDRESS": "10.20.30.128",
 *              "MAX_ADDRESS": "10.20.30.255",
 *              "MIN_PORT": 12345,
 *              "MAX_PORT": 23456
 *          },
 *          "MATCH_DST": {
 *              "IF_INDEX": 101,
 *              "MIN_ADDRESS": "10.20.30.128",
 *              "MAX_ADDRESS": "10.20.30.255",
 *              "MIN_PORT": 20000,
 *              "MAX_PORT": 50000
 *          },
 *          "ACTION": "ACCEPT"
 *      },
 * ...
 * ]}
 *
 * SNAT
 *
 * {"DATA": [
 *   {
 *      "NAME": "my-snat-1",
 *      "RULE_ID": 1,
 *      "STATE": "0: disabled, 1: enabled"
 *      "STATE": 1
 *      "ISP": "必填",
 *      "ISP": 1,
 *      "PROTOCOL": 6,
 *      "MATCH": {
 *          "IF_INDEX": 101,
 *          "MIN_ADDRESS": "10.20.30.128",
 *          "MAX_ADDRESS": "10.20.30.255",
 *          "MIN_PORT": 12345,
 *          "MAX_PORT": 23456
 *      },
 *      "TARGET": {
 *          "IF_INDEX": "必填，只能是WAN",
 *          "IF_INDEX": 2,
 *          "MIN_ADDRESS": "192.168.21.128",
 *          "MAX_ADDRESS": "192.168.21.255",
 *          "MIN_PORT": 20000,
 *          "MAX_PORT": 50000
 *      }
 *    },
 *   ...
 * ]}
 *
 * DNAT
 *
 * {"DATA": [
 *     {
 *         "NAME": "my-dnat-1",
 *         "RULE_ID": 1,
 *         "STATE": "0: disabled, 1: enabled"
 *         "STATE": 1
 *         "ISP": "必填",
 *         "ISP": 1,
 *         "PROTOCOL": 6,
 *         "MATCH": {
 *              "IF_INDEX": 1,
 *              "MIN_ADDRESS": "192.168.21.128",
 *              "MAX_ADDRESS": "192.168.21.255",
 *              "MIN_PORT": 12345,
 *              "MAX_PORT": 23456
 *          },
 *          "TARGET": {
 *              "MIN_ADDRESS": "10.20.30.128",
 *              "MAX_ADDRESS": "10.20.30.255",
 *              "MIN_PORT": 20000,
 *          "MAX_PORT": 50000
 *      }
 * },
 * ...
 * ]}
 *
 * VPN
 *
 * {"DATA": [{
 *     "NAME", "my-vpn",
 *     "STATE": "0: disabled, 1: enabled"
 *     "STATE": 1
 *     "ISP": "必填",
 *     "ISP": 1,
 *     "LEFT": "192.168.21.2",
 *     "LNETWORK": {
 *          "ADDRESS": "10.20.30.0",
 *          "NETMASK": "255.255.255.0"
 *     },
 *     "RIGHT": "4.4.4.4",
 *     "RNETWORK": {
 *          "ADDRESS": "10.20.30.0",
 *          "NETMASK": "255.255.255.0"
 *     },
 *     "PSK": "ASCII码在32~126之间的字符，除去双引号\"和反引号`",
 *     "PSK": "the-pre-share key"
 * }]}
 *
 * Route
 *
 * {"DATA": [{
 *      "NAME": "my-route",
 *      "STATE": "0: disabled, 1: enabled"
 *      "STATE": 1
 *      "ISP": "必填",
 *      "ISP": 1,
 *      "DST_NETWORK": {
 *         "ADDRESS": "10.20.30.0",
 *         "NETMASK": "255.255.255.0"
 *     },
 *     "NEXT_HOP": "192.168.0.1"
 * }]}
 */
server.get(API_PREFIX + '/vgateways/:vgateway_lcuuid/:config', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vgateway = new Vgateway();
        vgateway.get_config(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});
server.put(API_PREFIX + '/vgateways/:vgateway_lcuuid/:config', function (req, res, next){
    var data = req.body;
    data.vgateway_lcuuid = req.params.vgateway_lcuuid;
    data.config = req.params.config;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vgateway = new Vgateway();
        vgateway.update_config(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /valves/ Valve Create
 * @apiDescription 创建带宽共享器
 * @apiVersion 3.4.0
 * @apiGroup valve
 * @apiParam {Number} USERID Users unique ID
 * @apiParam {Number} ORDER_ID Order unique ID
 * @apiParam {String{1..20}} NAME The valve name
 * @apiParam {String} ALLOCATION_TYPE Create mode
 * @apiParam {String} GW_POOL_LCUUID Gateway pool lcuuid
 * @apiParam {String} GW_LAUNCH_SERVER The gateway server IP address
 * @apiParam {String} DOMAIN Domain lcuuid
 * @apiParam {String} PRODUCT_SPECIFICATION_LCUUID Product specification lcuuid
 * @apiParamExample {json} Request-Example
 *
 * Create valve（手动分配宿主机）
 * {
 *      "USERID": 1,
 *      "OEDER_ID":1,
 *      "NAME":"my-valve",
 *      "ALLOCATION_TYPE":"MANUAL",
 *      "GW_POOL_LCUUID":"a7298132-0220-4371-848a-66583a8510b6",
 *      "GW_LAUNCH_SERVER":"192.168.1.2",
 *      "DOMAIN":"a7298132-0220-4371-848a-66583a8510b6",
 *      "PRODUCT_SPECIFICATION_LCUUID":"a7298132-0220-4371-848a-66583a8510b6"
 * }
 *
 * Create valve（自动分配宿主机）
 * {
 *      "USERID": 1,
 *      "OEDER_ID":1,
 *      "NAME":"my-valve",
 *      "ALLOCATION_TYPE":"AUTO",
 *      "DOMAIN":"a7298132-0220-4371-848a-66583a8510b6",
 *      "PRODUCT_SPECIFICATION_LCUUID":"a7298132-0220-4371-848a-66583a8510b6"
 * }
 */

server.post(API_PREFIX + '/valves', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_create('valve', data, res_return)('', function(){logger.info('valve create end')});
    }).catch(function(err){logger.error(err)});
});

//start charge valve
server.post(API_PREFIX + '/charges/valves/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var valve = new Valve();
        valve.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//delete valve
/**
 * @api {delete} /valves/:id Valve Delete
 * @apiVersion 3.4.0
 * @apiGroup valve
 * @apiParam {Number} ID Valves unique ID
 * @apiParamExample Url-Example
 * /valves/1
 * @apiSuccessExample {json} Success-Response:
 * {
 *     "TYPE":"VALVE",
 *     "DESCRIPTION":"",
 *     "OPT_STATUS":"SUCCESS",
 *     "OPT_STATUS_CH":"",
 *     "OPT_STATUS_EN":""
 * }
 */

server.del(API_PREFIX + '/valves/:id', function(req, res, next){
    logger.debug('delete target is valve', req.params);
    var data = {id:req.params.id, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_action('del')('valve', data, res_return)('', function(){logger.info('valve delete end')})
    }).catch(function(err){logger.error(err)});
});

//get valve
/**
 * @api {get} /valves/:id Valve Get
 * @apiVersion 3.4.0
 * @apiGroup valve
 * @apiParam {Number} ID Valves unique ID
 * @apiParamExample Url-Example
 * /v1/valves/1
 * @apiSuccessExample {json} Success-Response:
 * {
 *     DATA: {
 *         "LCUUID":"a0f9f1e5-fbf1-4850-aae4-55f79d6c2bee",
 *         "PRODUCT_SPECIFICATION_LCUUID":"f36e9713-5b53-4210-8d45-0ae06154bf0f",
 *         "DOMAIN":"a7298132-0220-4371-848a-66583a8510b6",
 *         "NAME":"bwt-117-120",
 *         "GW_POOL_LCUUID":"0af4a52b-b99f-4951-b1af-34ec0fe8745b",
 *         "GENERAL_BANDWIDTH":0,
 *         "ERRNO":0,
 *         "INTERFACES":[
 *             {"WAN":{"IPS":[],"QOS":{"MAX_BANDWIDTH":0,"MIN_BANDWIDTH":0}},"STATE":2,"IF_INDEX":1,"IF_TYPE":"WAN"},
 *             {"WAN":{"IPS":[],"QOS":{"MAX_BANDWIDTH":0,"MIN_BANDWIDTH":0}},"STATE":2,"IF_INDEX":2,"IF_TYPE":"WAN"},
 *             {"WAN":{"IPS":[],"QOS":{"MAX_BANDWIDTH":0,"MIN_BANDWIDTH":0}},"STATE":2,"IF_INDEX":3,"IF_TYPE":"WAN"},
 *             {"WAN":{"IPS":[],"QOS":{"MAX_BANDWIDTH":0,"MIN_BANDWIDTH":0}},"STATE":2,"IF_INDEX":4,"IF_TYPE":"WAN"},
 *             {"STATE":2,"IF_INDEX":10,"LAN":{"IPS":[],"VL2_LCUUID":null,"QOS":{"MAX_BANDWIDTH":0,"MIN_BANDWIDTH":0},"VLANTAG":null},"IF_TYPE":"LAN"}
 *         ],
 *         "USERID":2,
 *         "GW_LAUNCH_SERVER":"172.16.1.120",
 *         "EPC_ID":1,
 *         "IPS":3,
 *         "STATE":3,
 *         "ROLE":11,
 *         "ID":13,
 *         "CREATE_TIME":"2015-01-30T05:17:40.000Z",
 *         "USER":{"ID":2,"USERNAME":"username","STATE":1},
 *         "EPC":{"ID":1,"EPCNAME":"epcname"},
 *         "DOMAIN_INFO":{"LCUUID":"a7298132-0220-4371-848a-66583a8510b6","DOMAINNAME":"beijing"}
 *     },
 *     "WAIT_CALLBACK":false,
 *     "TYPE":"VALVE",
 *     "DESCRIPTION":"",
 *     "OPT_STATUS":"SUCCESS",
 *     "OPT_STATUS_CH":"",
 *     "OPT_STATUS_EN":""
 *
 * }
 */

server.get(API_PREFIX + '/valves/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var valve = new Valve();
        valve.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});
/**
 * @api {get} /valves Valve Get
 * @apiVersion 3.4.0
 * @apiGroup valve
 * @apiParam {Number} page_size The page size
 * @apiParam {Number} page_index The page number
 * @apiParam {Number} userid User unique ID
 * @apiParamExample Url-Example
 * /valves/?page_size=10&page_index=1&userid=2
 * @apiSuccessExample {json} Success-Response:
 * {
 *     DATA:[{
 *         CREATE_TIME: "2015-01-30 13:17:40",
 *         DOMAIN: "a7298132-0220-4371-848a-66583a8510b6",
 *         DOMAIN_INFO: {LCUUID: "a7298132-0220-4371-848a-66583a8510b6", DOMAINNAME: "beijing"},
 *         EPC: {ID: 1, EPCNAME: "epaname"},
 *         EPC_ID: 1,
 *         ERRNO: 0,
 *         GENERAL_BANDWIDTH: 0,
 *         GW_LAUNCH_SERVER: "172.16.1.120",
 *         GW_POOL_LCUUID: "0af4a52b-b99f-4951-b1af-34ec0fe8745b",
 *         ID: 13,
 *         INTERFACES: [{WAN: {IPS: [], QOS: {MAX_BANDWIDTH: 0, MIN_BANDWIDTH: 0}}, STATE: 2, IF_INDEX: 1, IF_TYPE: "WAN"},…],
 *         IPS: 3,
 *         LCUUID: "a0f9f1e5-fbf1-4850-aae4-55f79d6c2bee",
 *         NAME: "bwt-117-120",
 *         PRODUCT_SPECIFICATION_LCUUID: "f36e9713-5b53-4210-8d45-0ae06154bf0f",
 *         ROLE: 11,
 *         STATE: 3,
 *         USER: {ID: 2, USERNAME: "username", STATE: 1},
 *         USERID: 2
 *     },...],
 *     DESCRIPTION: "",
 *     OPT_STATUS: "SUCCESS",
 *     OPT_STATUS_CH: ""
 *     OPT_STATUS_EN: ""
 *     PAGE: {INDEX: 1, TOTAL: 2, SIZE: 10},
 * }
 */

server.get(API_PREFIX + '/valves', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var valve = new Valve();
        valve.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//update valve
/**
 * @api {patch} /valves/:id Valve Operation
 * @apiVersion 3.4.0
 * @apiGroup valve
 * @apiParam {Number} ID Valves unique ID
 * @apiParam {Sreing{1..20}} Name New Valve name
 * @apiParamExample Url-Example
 * /valves/1
 * @apiParamExample {json} Request-Example
 * Modify valve name
 * {
 *     NAME:"new-name"
 * }
 * Mofigy valve network configure
 * {
 *     "DATA": {
 *         "GENERAL_BANDWIDTH":1,
 *         "INTERFACES":[{
 *            "if_index":1,
 *            "state": 1,
 *            "if_type": "LAN",
 *            "lan": {
 *                "vl2_lcuuid":"",
 *                "ips": [{"vl2_net_index":1,"address": '0.0.0.0'}],
 *                "qos": { "min_bandwidth": 0, "max_bandwidth": 0 }
 *            }
 *         },{
 *             "if_index": 1,
 *             "state": 1,
 *             "if_type":'WAN',
 *             "wan": {
 *                 "ips": [{"ip_resource_lcuuid":"lcuuid"}],
 *                 "qos": { "min_bandwidth": bandwidth, "max_bandwidth": bandwidth }
 *              }
 *         },...]
 *     }
 * }
 * @apiSuccess {String} OPT_STATUS State info.
 * @apiSuccess {String} OPT_STATUS_CH CH state info.
 * @apiSuccess {String} OPT_STATUS_EN EN state info.
 * @apiSuccessExample {json} Success-Response:
 * {
 *   "OPT_STATUS":"SUCCESS",
 *   "OPT_STATUS_CH":"",
 *   "OPT_STATUS_EN":""
 * }
 */

server.patch(API_PREFIX + '/valves/:id', function(req, res, next){
    logger.info('request body is', req.body);
    var data = req.body;
    data.id = req.params.id;
    logger.debug('request req.params.id is:', req.params.id);
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        if ('epc_id' in data) {
            var valve = new Valve();
            valve.setepc(data, res_return, res_return);
        }else if ('name' in data) {
            var valve = new Valve();
            valve.modify_valve_name(data, res_return, res_return);
        } else {
            standard_action('update')('valve', data, res_return)('', function(){logger.info('valve update end')});
        }
    }).catch(function(err){logger.error(err)});
});

//config valve

server.get(API_PREFIX + '/valves/:valve_lcuuid/:config', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var valve = new Valve();
        valve.get_config(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.put(API_PREFIX + '/valves/:valve_lcuuid/:config', function (req, res, next){
    var data = req.body;
    data.valve_lcuuid = req.params.valve_lcuuid;
    data.config = req.params.config;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var valve = new Valve();
        valve.update_config(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get nas_storages
server.get(API_PREFIX + '/nas-storages/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get nas_storage
server.get(API_PREFIX + '/nas-storages/:lcuuid', function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


/**
 * @api {post} /v1/nas-storages  NAS Storage Create
 * @apiGroup Nas-storage
 * @apiParamExample {json} Request-Example
 *
 * Create Nas-storage
 * {
 *      "NAME": "AAA",
 *      "PATH":"/10.33.20.3/mnt",
 *      "TOTAL_SIZE":100,
 *      "PROTOCOL":"NFS/CIFS",
 *      "PROTOCOL":"NFS",
 *      "VENDOR":"ZZHD",
 *      "USERID":2,
 *      "DOMAIN":"1234ae0e-a12a-42e3-a5df-99d87c453d20",
 *      "ORDER_ID":2,
 *      "PRODUCT_SPECIFICATION_LCUUID":"123456-100"
 * }
 */
server.post(API_PREFIX + '/nas-storages/', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.create(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//notify nas_storage info (api for zzhd)
server.patch(API_PREFIX + '/nas-storages/', function(req, res, next){
    var data = req.body;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.notify(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})


/**
 * @api {patch} /v1/nas-storages/:lcuuid  Nas-storage Modify
 * @apiGroup Nas-storage
 * @apiParamExample {json} Request-Example
 *
 * Modify Nas-storage
 * {
 *      "TOTAL_SIZE":100,
 * }
 */
//modify nas_storage
server.patch(API_PREFIX + '/nas-storages/:lcuuid/', function(req, res, next){
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.modify(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})


/**
 * @api {post} /v1/nas-storages/:lcuuid/connection  Nas-storage-plug Create
 * @apiGroup Nas-storage-plug
 * @apiParamExample {json} Request-Example
 *
 * Create Nas-storage-info
 * {
 *      "VM_LCUUID":"aaa-llll-bbbb"
 * }
 */
//plug nas_storage
server.post(API_PREFIX + '/nas-storages/:lcuuid/connection/', function(req, res, next){
    logger.debug('nas plug request params is', req.params);
    var data = {};
    data.lcuuid = req.params.lcuuid;
    data.VM_LCUUID = req.body.VM_LCUUID;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.plug(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})


/**
 * @api {delete} /v1/nas-storages/:lcuuid/connection/:connection_lcuuid/ Nas-storage-plug Delete
 * @apiGroup Nas-storage-plug
 * @apiDescription Delete Nas-storage-plug
 */
//unplug nas_storage
server.del(API_PREFIX + '/nas-storages/:lcuuid/connection/:connection_lcuuid/', function(req, res, next){
    logger.debug('request params is', req.params);
    var data = {};
    data.lcuuid = req.params.lcuuid;
    data.connection_lcuuid = req.params.connection_lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.unplug(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})


/**
 * @api {delete} /v1/nas-storages/:lcuuid Nas-storage Delete
 * @apiGroup Nas-storage
 * @apiDescription Delete Nas-storage
 */
//delete nas_storage
server.del(API_PREFIX + '/nas-storages/:lcuuid/', function(req, res, next){
    logger.debug('request params is', req.params);
    var data = {};
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.del(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//Start charge nas_storage
server.post(API_PREFIX + '/charges/nas-storages/:id/', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var nas_storage = new NasStorage();
        nas_storage.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})


/**
 * @api {post} /v1/vul-scanners  Vul-scanner Create
 * @apiGroup Vul-scanner
 * @apiParamExample {json} Request-Example
 *
 * Create Vul-scanner
 * {
 *       "vm_lcuuid":"b62d08c5-ac63-479f-803f-02f33e19c42d",
 *       "task_type":1, 1.sys-scan 2.web-scan
 *       "userid":2,
 *       "order_id":1,
 *       "product_specification_lcuuid":"123456-100",
 *       "domain": "xxxxxxxxxx"
 * }
 */
//create vul_scanner
server.post(API_PREFIX + '/vul-scanners', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    logger.debug('request params is', data);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vul_scanner = new VulScanner();
        vul_scanner.create(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vul_scanner
server.get(API_PREFIX + '/vul-scanners/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vul_scanner = new VulScanner();
        vul_scanner.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vul_scanner_report
server.get(API_PREFIX + '/vul-scanner-report/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vul_scanner = new VulScanner();
        vul_scanner.getreport(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.get(API_PREFIX + '/vul-scanners', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vul_scanner = new VulScanner();
        vul_scanner.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vul_scanner vms
server.get(API_PREFIX + '/vul-scanners-vms', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vul_scanner = new VulScanner();
        vul_scanner.getvms(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//Start charge vul_scanner
server.post(API_PREFIX + '/charges/vul-scanners/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vul_scanner = new VulScanner();
        vul_scanner.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {post} /v1/user-ip-resources IP Allocation
 * @apiDescription 购买公网IP，将会分配一个未被占用的公网IP给特定租户
 * @apiGroup ISP
 * @apiParamExample {json} Request-Example
 *
 * Allocation IP
 * {
 *     "userid": 2,
 *     "order_id": 1,
 *     "domain": "396a40e9-749d-4949-99d2-32f582145d44",
 *     "ip_resource_lcuuid": "396a40e9-749d-4949-99d2-32f582145d44"
 *     "isp": "和ip_resource_lcuuid不可共存"
 *     "isp": 1
 * }
 */
server.post(API_PREFIX + '/user-ip-resources', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var isp = new Isp();
        isp.user_ip_resources(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {delete} /v1/user-ip-resources/:ip_resource_lcuuid  IP Recycle
 * @apiDescription 回收公网IP，将租户的公网IP回收并停止计费
 * @apiGroup ISP
 * @apiDescription Recycle IP
 */
server.del(API_PREFIX + '/user-ip-resources/:ip_resource_lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var isp = new Isp();
        isp.del_user_ip_resources(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /v1/user-ip-resources IP Get
 * @apiDescription 获取公网IP列表
 * @apiGroup ISP
 * @apiParamExample {json} Request-Example
 *
 * Get IP
 * {
 *     "userid": 可选
 *     "userid": 2,
 *     "order_id": 可选
 *     "order_id": 1,
 *     "domain": 可选
 *     "domain": "396a40e9-749d-4949-99d2-32f582145d44",
 *     "page_index": 可选
 *     "page_index": 1,
 *     "page_size": 可选
 *     "page_size": 10
 * }
 */
server.get(API_PREFIX + '/user-ip-resources', function(req, res, next){
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.get_user_ip_resources(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /v1/bandwidth-orders Bandwidth Order Get
 * @apiDescription 获取公网带宽选购列表，返回所有租户选购公网带宽的信息列表
 * @apiGroup bandwidth
 */
server.post(API_PREFIX + '/bandwidth-orders', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var isp = new Isp();
        isp.user_order_isp_bandwidths(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /v1/bandwidths Bandwidth Get
 * @apiDescription 获取公网带宽分配列表，返回所有租户选购的总公网带宽信息
 * @apiGroup bandwidth
 */
server.get(API_PREFIX + '/bandwidths', function(req, res, next){
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.get_user_isp_bandwidths(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /v1/bandwidths/:lcuuid Bandwidth Get
 * @apiDescription 获取公网带宽分配信息，返回特定租户选购的公网带宽信息
 * @apiGroup bandwidth
 */
server.get(API_PREFIX + '/bandwidths/:lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.get_user_isp_bandwidths(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

server.patch(API_PREFIX + '/bandwidths/:lcuuid', function(req, res, next){
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.update_user_isp_bandwidths(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

server.get(API_PREFIX + '/bandwidth-orders', function(req, res, next){
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.get_user_order_isp_bandwidths(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {post} /v1/isps ISP Create
 * @apiGroup ISP
 * @apiParamExample {json} Request-Example
 *
 * Create ISP
 * {
 *     "name": "chinamobile",
 *     "userid": 1,
 *     "domain": "396a40e9-749d-4949-99d2-32f582145d44",
 * }
 */
//create isp
server.post(API_PREFIX + '/isps', function (req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.create_isp(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {delete} /v1/isps/:lcuuid ISP Delete
 * @apiGroup ISP
 * @apiDescription Delete ISP
 */
//delete isp
server.del(API_PREFIX + '/isps/:lcuuid', function (req, res, next){
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.del_isp(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {put} /v1/isps/:lcuuid ISP Modify
 * @apiGroup ISP
 * @apiParamExample {json} Request-Example
 *
 * Modify ISP
 * {
 *     "name": "chinamobile"
 * }
 */
//update isp
server.put(API_PREFIX + '/isps/:lcuuid', function (req, res, next){
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var isp = new Isp();
        isp.update_isp(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /v1/isps/:lcuuid ISP Get
 * @apiGroup ISP
 * @apiDescription Get IP
 */
//get isp
server.get(API_PREFIX + '/isps/:lcuuid', function (req, res, next){
    var res_return = gen_res_return(res, next);
    atry (function(){
        var isp = new Isp();
        isp.get_isp(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err.stack)});
});

/**
 * @api {get} /v1/isps ISP Get
 * @apiGroup ISP
 * @apiParamExample {json} Request-Example
 *
 * Get ISP
 * {
 *     "userid": 可选
 *     "userid": 2,
 *     "domain": 可选
 *     "domain": "396a40e9-749d-4949-99d2-32f582145d44"
 * }
 */
server.get(API_PREFIX + '/isps', function (req, res, next){
    atry(function(){
        var res_return = gen_res_return(res, next);
        var isp = new Isp();
        isp.get_isp(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err.stack)});
});

//get instance-roles
server.get(API_PREFIX + '/instance-roles', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var instance_role = new InstanceRole();
        instance_role.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get logic topologies stats
server.get(API_PREFIX + '/stats/logic-topologies/:epc_id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var stats = new Stats();
        stats.logic_topo_get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vm tx stats
server.get(API_PREFIX + '/stats/vm-tx-traffic-histories/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var stats = new Stats();
        stats.vm_tx_get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /v1/lbs  LB Create
 * @apiGroup LB
 * @apiParamExample {json} Request-Example
 *
 * Create LB
 * 同VM
 */
//create lbs vm
server.post(API_PREFIX + '/lbs/', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.type = 'lb';
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        standard_create('vm', data, res_return)('', function(){logger.info('lb create end')});
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {delete} /v1/lbs/:id  LB Delete
 * @apiGroup LB
 * @apiDescription Delete LB
 */
//delete lbs
server.del(API_PREFIX + '/lbs/:id/', function(req, res, next){
    logger.debug('delete target is lb', req.params);
    var data = {id:req.params.id, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    var flag = false;
    var app = new flow.serial([
        function(a, f){
            var vm = new Vm();
            vm.selectSql([vm.tableName, 'id', data.id],
                function(vms) {
                    if (vms.length > 0) {
                        if (vms[0].state == vm.state.RUNNING) {
                            res_return(200, {OPT_STATUS: 'SUCCESS'});
                            flag = true;
                        }
                        f(a);
                     } else {
                         res_return(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,DESCRIPTION: 'lb is not found'});
                     }
                },res_return);
          },
          function(a, f){
              if(flag){
                  return standard_action('stop')('vm', data, function(){})('', function(data){logger.info('lb stop end'); f(data)});
              }else{
                  f(a);
              }
          },
          function(a, f){
              return  standard_action('del')('vm', data, function(){})('', function(data){logger.info('lb delete end'); f(data)});
          }
    ]);
    app.fire('', function(){logger.info("lb del is ok");});
});

/**
 * @api {patch} /v1/lbs/:id LB Operation
 * @apiGroup LB
 * @apiParamExample {json} Request-Example
 *
 * 同VM
 */
//update lb
server.patch(API_PREFIX + '/lbs/:id/', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.id = req.params.id;
    var product_specification_lcuuid = data.product_specification_lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    var flag = false;
    atry(function(){
        if ('action' in data){
            if (['modify'].indexOf(data.action) > -1){
                var app = new flow.serial([
                   function(a, f){
                       var vm = new Vm();
                       vm.selectSql([vm.tableName, 'id', data.id],function(vms) {
                           if (vms.length > 0) {
                               if (vms[0].state == vm.state.RUNNING) {
                                   res_return(200, {OPT_STATUS: 'SUCCESS'});
                                   flag = true;
                               }
                               f(a);
                            } else {
                                res_return(404,{OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND,DESCRIPTION: 'lb is not found'});
                            }
                       },res_return);
                   },
                   function(a, f){
                       if(flag){
                           return standard_action('stop')('vm', data, function(){})('', function(data){logger.info('lb stop end'); f(data)});
                       }else{
                           f(a);
                       }
                   },
                   function(a, f){
                       var newdata = {action:'modify',id:data.id,product_specification_lcuuid:product_specification_lcuuid}
                       return  standard_action('modify')('vm', newdata, function(){})('', function(data){logger.info('lb modify end'); f(data)});
                   },
                   function(a, f){
                       if(flag){
                           var newdata = {action:'start',id:data.id}
                           return  standard_action('start')('vm', newdata, function(){})('', function(data){logger.info('lb start end'); f(data)});
                       }else{
                           f(a);
                       }
                    }
                ]);
                app.fire('', function(){logger.info("lb update is ok");});
            } if (['setepc'].indexOf(data.action) > -1){
                var vm = new Vm();
                vm.setData(data);
                vm[data.action](data, res_return, res_return);
            } else if (['modifyinterface'].indexOf(data.action) > -1) {
                var vm = new Vm();
                vm[data.action](data, res_return, res_return);
            } else {
                res_return(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA,DESCRIPTION: 'post not found request action'});
            }
        } else{
            res_return(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA,DESCRIPTION: 'post not found action'});
        }
    }).catch(function(err){logger.error(err)});
});


//get lbs
server.get(API_PREFIX + '/lbs', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lbs(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get lbs
server.get(API_PREFIX + '/lbs/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lbs(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//create lb-listeners
server.post(API_PREFIX + '/lbs/:lb_lcuuid/lb-listeners/', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.lb_lcuuid = req.params.lb_lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.lbs_create_listeners(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


//update lb-listeners
server.put(API_PREFIX + '/lbs/:lb_lcuuid/lb-listeners/:lcuuid/', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.lb_lcuuid = req.params.lb_lcuuid;
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.lbs_modify_listeners(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//delete lb-listeners
server.del(API_PREFIX + '/lbs/:lb-lcuuid/lb-listeners/:lcuuid/', function (req, res, next){
    logger.debug('request body is', req.params);
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.lbs_delete_listeners(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//update lb-bk-vms
server.patch(API_PREFIX + '/lbs/:lb_lcuuid/lb-listeners/:lb_listener_lcuuid/lb-bk-vms/:lcuuid/',
             function(req, res, next) {
    logger.debug('request body is', req.body);
    var data = req.body;
    data.lb_lcuuid = req.params.lb_lcuuid;
    data.lb_listener_lcuuid = req.params.lb_listener_lcuuid;
    data.lcuuid = req.params.lcuuid;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.lbs_modify_bk_vms(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get lbs listeners
server.get(API_PREFIX + '/lbs/:lb-lcuuid/lb-listeners/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = req.params;
    atry(function(){
        var lb = new LB();
        lb.get_lbs_listeners(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get lbs listeners
server.get(API_PREFIX + '/lbs/:lb-lcuuid/lb-listeners/:lb-listener-lcuuid/lb-bk-vms/:lcuuid/', function(req, res, next){
    logger.debug('request params is', req.params);
    var data = req.params;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lbs_listeners_lb_bk_vms(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//Attach/Detach lb vinterface
server.put(API_PREFIX + '/lbs/:id/interfaces/:ifindex/', function(req, res, next){
    var data = req.body;
    data.id = req.params.id;
    data.ifindex = req.params.ifindex;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vm = new Vm();
        vm.putinterface(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//Start charge lb
server.post(API_PREFIX + '/charges/lbs/:id/', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {post} /v1/lb-clusters  Lb_Cluster Create
 * @apiGroup LB
 * @apiParamExample {json} Request-Example
 *
 * Create Lb_Cluster
 * {
 *     "MASTER_LB_LCUUID":"5e09190f-d80a-4704-a102-9355a6895ed3",
 *     "BACKUP_LB_LCUUID":"7dd6466e-6d51-4a35-b0aa-476fdc693e1e"
 * }
 */
//Create lb_cluster
server.post(API_PREFIX + '/lb-clusters', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var lb = new LB();
        lb.create_lb_cluster(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {delete} /v1/lb-clusters/:lb_cluster_lcuuid  Lb_Cluster Delete
 * @apiGroup LB
 * @apiDescription Delete Lb_Cluster
 */
//Delete lb_cluster
server.del(API_PREFIX + '/lb-clusters/:lb_cluster_lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var lb = new LB();
        lb.delete_lb_cluster(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {patch} /v1/lb-clusters/:lb_cluster_lcuuid  Lb_Cluster Switch
 * @apiGroup LB
 * @apiParamExample {json} Request-Example
 *
 * Switch Lb_Cluster
 * {
 *     "MASTER_LB_LCUUID":"5e09190f-d80a-4704-a102-9355a6895ed3"
 * }
 */
//Patch lb_cluster
server.patch(API_PREFIX + '/lb-clusters/:lb_cluster_lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.lb_cluster_lcuuid = req.params.lb_cluster_lcuuid;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var lb = new LB();
        lb.update_lb_cluster(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//get lb_clusters
server.get(API_PREFIX + '/lb-clusters', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lb_clusters(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get lb_cluster
server.get(API_PREFIX + '/lb-clusters/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lb_clusters(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /v1/lb-forward-rules  Lb_Forward_Rule Create
 * @apiGroup LB
 * @apiParamExample {json} Request-Example
 *
 * Create Lb_Forward_Rule
 * {
 *     "NAME": "example",
 *     "TYPE": "URL",
 *     "CONTENT": ".php$",
 *     "USERID": 2
 * }
 */
//Create lb_forward_rule
server.post(API_PREFIX + '/lb-forward-rules', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var lb = new LB();
        lb.create_lb_forward_rule(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {post} /v1/lb-forward-rules/forward_rule_lcuuid  Lb_Forward_Rule Delete
 * @apiGroup LB
 * @apiDescription Delete Lb_Forward_Rule
 * }
 */
//Delete lb_forward_rule
server.del(API_PREFIX + '/lb-forward-rules/:lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var data = req.params;
    data.operator_name = get_authorization_username(req);
    atry(function(){
        var lb = new LB();
        lb.delete_lb_forward_rule(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//get lb_forward_rules
server.get(API_PREFIX + '/lb-forward-rules', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lb_forward_rules(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get lb_forward_rules
server.get(API_PREFIX + '/lb-forward-rules/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var lb = new LB();
        lb.get_lb_forward_rules(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vfws
server.get(API_PREFIX + '/vfws', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vfw = new Vfw();
        vfw.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get vfw
server.get(API_PREFIX + '/vfws/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vfw = new Vfw();
        vfw.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//Start charge vfw
server.post(API_PREFIX + '/charges/vfws/:id', function(req, res, next){
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vfw = new Vfw();
        vfw.start_charge(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

//create cloud disk
server.post(API_PREFIX + '/cloud-disks', function(req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.create(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//modify cloud disk
server.patch(API_PREFIX + '/cloud-disks/:cloud_disk_lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    data.cloud_disk_lcuuid = req.params.cloud_disk_lcuuid;
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.modify(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//del cloud disk
server.del(API_PREFIX + '/cloud-disks/:cloud_disk_lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = {cloud_disk_lcuuid:req.params.cloud_disk_lcuuid,operator_name:get_authorization_username(req)};
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.del(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//plug cloud disk
server.post(API_PREFIX + '/cloud-disks/:cloud_disk_lcuuid/connection/', function(req, res, next){
    logger.debug('request params is', req.params);
    logger.debug('request body is', req.body);
    var res_return = gen_res_return(res, next);
    var data = {};
    data.operator_name = get_authorization_username(req);
    data.cloud_disk_lcuuid = req.params.cloud_disk_lcuuid;
    data.VM_LCUUID = req.body.VM_LCUUID;
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.plug(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//unplug cloud disk
server.del(API_PREFIX + '/cloud-disks/:cloud_disk_lcuuid/connection/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = {};
    data.operator_name = get_authorization_username(req);
    data.cloud_disk_lcuuid = req.params.cloud_disk_lcuuid;
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.unplug(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//start charges
server.post(API_PREFIX + '/charges/cloud-disks/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.startCharge(date, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//stop charges
server.del(API_PREFIX + '/charges/cloud-disks/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.stopCharge(date, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});
//////
//get cloud disk
server.get(API_PREFIX + '/cloud-disks/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get cloud disk
server.get(API_PREFIX + '/cloud-disks/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var cloudDisk = new CloudDisk();
        cloudDisk.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get service vendor
server.get(API_PREFIX + '/service-vendors/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vendor = new Vendor();
        vendor.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get service vendor
server.get(API_PREFIX + '/service-vendors', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vendor = new Vendor();
        vendor.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /order/ orderCreate
 * @apiVersion 3.4.0
 * @apiGroup order
 * @apiParam {Object[]} vm list of vms to create
 * @apiParamExample {json} Request-Example
 * {
 *  vm: [],
 *  vgw: []
 * }
 * @apiParam [vm]
 */
var order_create = server.post(API_PREFIX + '/orders', function(req, res, next){
    logger.info('orders request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var order = new Order();
        order.create(data, standard_create, standard_action, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get domain
server.get(API_PREFIX + '/domains', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var domain = new Domain();
        domain.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get domain
server.get(API_PREFIX + '/domains/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var domain = new Domain();
        domain.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//create order services
server.post(API_PREFIX + '/order-services', function(req, res, next){
    logger.info('orders-services request body is', req.body);
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var order_services = new Order_Services();
        order_services.create_services(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get template os
server.get(API_PREFIX+'/ostemplates', function(req, res, next){
    logger.info('template request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var osTemplate = new OsTemplate();
        osTemplate.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

server.get('benchmark', function(req, res, next){
    atry(function(){
        var res_return = gen_res_return(res, next);
        req.checkParams('a', 'require an int').isInt();
        var errors = req.validationErrors();
        if (errors){
            res_return({OPT_STATUS: 'failed', MSG: 'There have been validation errors: ' + util.inspect(errors)});
            return;
        }
        res_return({OPT_STATUS:'ok'});
    }).catch(function(err){logger.error(err)});
})

//get order
server.get(API_PREFIX + '/order-charges/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var order_charge = new Order_Charge();
        order_charge.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get order
server.get(API_PREFIX + '/order-charges', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var order_charge = new Order_Charge();
        order_charge.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /products/ getProducts
 * @apiVersion 3.4.0
 * @apiDescription for bss sync oss products
 * @apiGroup mt
 */
server.get(API_PREFIX + '/products', function(req, res, next){
    if (!('mtkey' in req.headers) || req.headers['mtkey'] !=  constr.MT_KEY) {
        res.send(401);
        next();
        return;
    }
    var res_return = gen_res_return(res, next);
    atry(function(){
        var product = new Product();
        product.getAll(res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {post} /bssdomain/ resetBssDomain
 * @apiVersion 3.4.0
 * @apiDescription for bss set bss domain to oss
 * @apiGroup mt
 */
server.post(API_PREFIX + '/bssdomain', function(req, res, next){
    if (!('mtkey' in req.headers) || req.headers['mtkey'] !=  constr.MT_KEY) {
        res.send(401);
        next();
        return;
    }
    var res_return = gen_res_return(res, next);
    logger.info('request body is', req.body);
    atry(function(){
        var domain = new Domain();
        domain.set_bss_domain(req.body, res_return, res_return);
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /chargedetail/ getChargeDetail
 * @apiVersion 3.4.0
 * @apiDescription for bss sync oss products
 * @apiGroup mt
 */
server.get(API_PREFIX + '/chargedetail', function(req, res, next){
    if (!('mtkey' in req.headers) || req.headers['mtkey'] !=  constr.MT_KEY) {
        res.send(401);
        next();
        return;
    }
})

/**
 * @api {get} /users getUsers
 * @apiVersion 3.4.0
 * @apiDescription for bss sync oss users
 * @apiGroup mt
 */
server.get(API_PREFIX + '/users', function(req, res, next){
    if (!('mtkey' in req.headers) || req.headers['mtkey'] !=  constr.MT_KEY) {
        res.send(401);
        next();
        return;
    }
    var res_return = gen_res_return(res, next);
    Obj.prototype.executeSql('select * from fdb_user_v2_2 where not user_type=1')(
        [],
        function(data){res_return({OPT_STATUS:constr.OPT.SUCCESS, DATA:data})},
        function(data){res_return(400)})
})
var Storage = require('./storage.js');

/**
 * @api {post} /blocks Block Create
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} USER_LCUUID Users uuid
 * @apiParam {Number} ORDER_ID Order unique ID
 * @apiParam {String} NAME The block name
 * @apiParam {Number} Size The size of the block
 * @apiParam {String} FROM_VOLUME The from volume
 * @apiParam {String} PRODUCT_SPECIFICATION_LCUUID Product specification lcuuid
 * @apiParamExample {json} Request-Example
 *
 * Create block
 * {
 *      "NAME": "block1",
 *      "SIZE": 10240,
 *      "FROM_VOLUME": false,
 *      "USER_LCUUID": "f20a53dd-473f-4a15-b3f7-ec89dec13932",
 *      "PRODUCT_SPECIFICATION_LCUUID": "8c7d19f4-595b-470d-b19c-fdcda8c49625",
 *      "ORDER_ID": 1
 * }
 */

server.post(API_PREFIX + '/blocks', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var block = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(block.create(data, res_return))
        .then(block.addLog(data, '创建云硬盘%s'))
        .then(block.addOrder())
        .resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /blocks Block Get
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} user-lcuuid The user lcuuid
 * @apiParam {String} storage-lcuuid The storage lcuuid
 * @apiParam {String} domain The Domain lcuuid
 * @apiParamExample Url-Example
 * /v1/blocks/?domain=931175df-dcb5-4209-bf15-3e35655aef89&user-lcuuid=f20a53dd-473f-4a15-b3f7-ec89dec13932&storage-lcuuid=8008b7a3-f3f4-4ea4-b294-ec1966ef788a
 */

server.get(API_PREFIX + '/blocks', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var block = new Storage();
        block.get(req.params, res_return).resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /blocks/:lcuuid Block Get
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} lcuuid Block lcuuid
 * @apiParam {String} user-lcuuid The user lcuuid
 * @apiParam {String} storage-lcuuid The storage lcuuid
 * @apiParam {String} domain The Domain lcuuid
 * @apiParamExample Url-Example
 * /v1/blocks/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/?domain=931175df-dcb5-4209-bf15-3e35655aef89&user-lcuuid=f20a53dd-473f-4a15-b3f7-ec89dec13932&storage-lcuuid=8008b7a3-f3f4-4ea4-b294-ec1966ef788a
 */

server.get(API_PREFIX + '/blocks/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var block = new Storage();
        block.get(req.params, res_return).resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {patch} /blocks/:lcuuid Block Modify
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} lcuuid block lcuuid
 * @apiParam {Number} SIZE The new size
 * @apiParamExample {json} Request-Example
 *
 * Modify block
 * {
 *      "SIZE": 10240
 * }
 */

server.patch(API_PREFIX + '/blocks/:lcuuid', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var block = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(block.modify(data, res_return))
        .then(block.addLog(data, '扩容云硬盘%s'))
        .then(block.addMofidyOrder())
        .resolve('', logger.info);

    }).catch(function(err){logger.error(err)});
});
/**
 * @api {delete} /blocks/:lcuuid Block Delete
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} lcuuid The block lcuuid
 * @apiParamExample Url-Example
 * /block/40ea1feb-d0f1-41b5-a35b-10515e0f6d37
 */

server.del(API_PREFIX + '/blocks/:lcuuid', function (req, res, next){
    logger.debug('delete target is blocks', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var block = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(block.del(req.params.lcuuid, res_return))
        .then(block.addLog({}, '删除云硬盘%s'))
        .resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /blocks/:lcuuid/snapshots Block Snapshot Create
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} NAME The block snapshot name
 * @apiParam {String} DESCRIPTION The description for block snapshot
 * @apiParam {String} PRODUCT_SPECIFICATION_LCUUID Product specification lcuuid
 * @apiParamExample {json} Request-Example
 *
 * Create block
 * {
 *      "NAME": "block1-snapshot",
 *      "DESCRIPTION": ""
 *      "PRODUCT_SPECIFICATION_LCUUID": "8c7d19f4-595b-470d-b19c-fdcda8c49625"
 * }
 */


server.post(API_PREFIX + '/blocks/:lcuuid/snapshots', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    data['lcuuid']= req.params.lcuuid;
    var operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var block = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(block.snapshot(data, res_return))
        .then(block.addSnapshotLog(data, '云硬盘%s创建快照'))
        .then(block.addSnapshotOrder());
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /blocks/:block_lcuuid/snapshots Block Snapshot Get
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} block_lcuuid The block lcuuid
 * @apiParamExample Url-Example
 * /v1/blocks/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/snapshots
 */

server.get(API_PREFIX + '/blocks/:block_lcuuid/snapshots', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var block = new Storage();
        block.get_snapshots(req.params, res_return).resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /blocks/:block_lcuuid/snapshots/:snapshot_lcuuid Block Snapshot Get
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} block_lcuuid The block lcuuid
 * @apiParam {String} snapshot_lcuuid The block snapshot lcuuid
 * @apiParamExample Url-Example
 * /v1/blocks/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/snapshots/236e5246-4da5-4680-834b-bea42eb5b3e4
 */

server.get(API_PREFIX + '/blocks/:block_lcuuid/snapshots/:snapshot_lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var block = new Storage();
        block.get_snapshots(req.params, res_return).resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {delete} /blocks/:block_lcuuid/snapshots/:snapshot_lcuuid Block Snapshot Delete
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} block_lcuuid The block lcuuid
 * @apiParam {String} snapshot_lcuuid The block snapshot lcuuid
 * @apiParamExample Url-Example
 * /v1/blocks/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/snapshots/236e5246-4da5-4680-834b-bea42eb5b3e4
 */

server.del(API_PREFIX + '/blocks/:block_lcuuid/snapshots/:snapshot_lcuuid', function (req, res, next){
    logger.debug('delete target is block snapshot', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var block = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(block.delSnapshot(req.params.block_lcuuid,req.params.snapshot_lcuuid, res_return))
        .then(block.addSnapshotLog('', '云硬盘%s删除快照'))
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /blocks/:block_lcuuid/snapshots/:snapshot_lcuuid/reversion Block Snapshot Reversion
 * @apiVersion 3.4.0
 * @apiGroup block
 * @apiParam {String} block_lcuuid The block lcuuid
 * @apiParam {String} snapshot_lcuuid The block snapshot lcuuid
 * @apiParamExample Url-Example
 * /v1/blocks/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/snapshots/236e5246-4da5-4680-834b-bea42eb5b3e4/reversion
 */

server.post(API_PREFIX + '/blocks/:block_lcuuid/snapshots/:snapshot_lcuuid/reversion', function (req, res, next){
    logger.debug('delete target is block snapshot', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var block = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('id', parseInt(Math.random()*100000));
        Q.setData('operatorName', operator_name);
        Q.then(block.reverseSnapshot(req.params.block_lcuuid,req.params.snapshot_lcuuid, res_return))
        .then(block.addSnapshotLog('', '云硬盘%s回滚快照'))
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /vm_snapshot/:lcuuid/snapshots Block Snapshot Create
 * @apiVersion 3.4.0
 * @apiGroup vmsnapshot
 * @apiParam {String} NAME The block snapshot name
 * @apiParam {String} DESCRIPTION The description for vm snapshot
 * @apiParam {String} PRODUCT_SPECIFICATION_LCUUID Product specification lcuuid
 * @apiParamExample {json} Request-Example
 *
 * Create block
 * {
 *      "NAME": "vm-snapshot",
 *      "DESCRIPTION": ""
 *      "PRODUCT_SPECIFICATION_LCUUID": "8c7d19f4-595b-470d-b19c-fdcda8c49625"
 * }
 */

server.post(API_PREFIX + '/vm_snapshot/:lcuuid/snapshots', function (req, res, next){
    logger.debug('request body is', req.body);
    var data = req.body;
    var operator_name = get_authorization_username(req);
    data['lcuuid']= req.params.lcuuid;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vmSnapshot = new Vm_Snapshot();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(vmSnapshot.snapshot(data, res_return))
        .then(vmSnapshot.addLog(data, '虚拟机%s创建快照'))
        .then(vmSnapshot.addOrder());
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /vm_snapshot/snapshots Vm Snapshot Get
 * @apiVersion 3.4.0
 * @apiGroup vmsnapshot
 * @apiParam {String} vm_lcuuid The vm lcuuid
 * @apiParam {Number} page_size The page size
 * @apiParam {Number} page_index The page number
 * @apiParam {Number} userid User unique ID
 * @apiParamExample Url-Example
 * /v1/vm_snapshot/snapshots?userid=2
 */

server.get(API_PREFIX + '/vm_snapshot/snapshots', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vmSnapshot = new Vm_Snapshot();
        vmSnapshot.get(req.params, res_return).resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /vm_snapshot/snapshots/:snapshot_lcuuid Vm Snapshot Get
 * @apiVersion 3.4.0
 * @apiGroup vmsnapshot
 * @apiParam {String} snapshot_lcuuid The block snapshot lcuuid
 * @apiParamExample Url-Example
 * /v1/vm_snapshot/snapshots/236e5246-4da5-4680-834b-bea42eb5b3e4
 */

server.get(API_PREFIX + '/vm_snapshot/snapshots/:snapshot_lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var vmSnapshot = new Vm_Snapshot();
        vmSnapshot.get(req.params, res_return).resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {delete} /vm_snapshot/:vm_lcuuid/snapshots/:snapshot_lcuuid Vm Snapshot Delete
 * @apiVersion 3.4.0
 * @apiGroup vmsnapshot
 * @apiParam {String} vm_lcuuid The vm lcuuid
 * @apiParam {String} snapshot_lcuuid The block lcuuid
 * @apiParamExample Url-Example
 * /v1/vm_snapshot/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/snapshots/236e5246-4da5-4680-834b-bea42eb5b3e4
 */

server.del(API_PREFIX + '/vm_snapshot/:vm_lcuuid/snapshots/:snapshot_lcuuid', function (req, res, next){
    logger.debug('delete target is block snapshot', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var vmSnapshot = new Vm_Snapshot();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(vmSnapshot.del(req.params.vm_lcuuid,req.params.snapshot_lcuuid, res_return))
        .then(vmSnapshot.addLog({lcuuid: req.params.vm_lcuuid}, '虚拟机%s删除快照'))
        .then(vmSnapshot.stopCharge());
        Q.resolve('', logger.info);

    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /vm_snapshot/:vm_lcuuid/snapshots/:snapshot_lcuuid/reversion Vm Snapshot Reversion
 * @apiVersion 3.4.0
 * @apiGroup vmsnapshot
 * @apiParam {String} vm_lcuuid The vm lcuuid
 * @apiParam {String} snapshot_lcuuid The vm snapshot lcuuid
 * @apiParamExample Url-Example
 * /v1/vm_snapshot/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/snapshots/236e5246-4da5-4680-834b-bea42eb5b3e4/reversion
 */

server.post(API_PREFIX + '/vm_snapshot/:vm_lcuuid/snapshots/:snapshot_lcuuid/reversion', function (req, res, next){
    logger.debug('reversion vm snapshot', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var vmSnapshot = new Vm_Snapshot();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(vmSnapshot.reverseSnapshot(req.params.vm_lcuuid,req.params.snapshot_lcuuid, res_return))
        .then(vmSnapshot.addLog({lcuuid: req.params.vm_lcuuid}, '虚拟机%s回滚快照'))
        .then(function(data, onFullfilled){ setTimeout(onFullfilled, 60000)})
        .then(vmSnapshot.resetVmNetwork(req.params.vm_lcuuid, logger.info))
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /vm_block/:vm_lcuuid/blocks/:block_lcuuid Vm Plug Block Device
 * @apiVersion 3.5.0
 * @apiGroup vm
 * @apiParam {String} vm_lcuuid The vm lcuuid
 * @apiParam {String} block_lcuuid The block_device lcuuid
 * @apiParamExample Url-Example
 * /v1/vm_block/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/blocks/236e5246-4da5-4680-834b-bea42eb5b3e4
 */

server.post(API_PREFIX + '/vm_block/:vm_lcuuid/blocks/:block_lcuuid', function (req, res, next){
    logger.debug('vm plug block device', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var storage = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(storage.plugToVm(req.params.vm_lcuuid,req.params.block_lcuuid, res_return))
        .then(storage.addPlugLog('', '虚拟机%s挂载云硬盘'))
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {delete} /vm_block/:vm_lcuuid/blocks/:block_lcuuid Vm unPlug Block Device
 * @apiVersion 3.5.0
 * @apiGroup vm
 * @apiParam {String} vm_lcuuid The vm lcuuid
 * @apiParam {String} block_lcuuid The block_device lcuuid
 * @apiParamExample Url-Example
 * /v1/vm_block/40ea1feb-d0f1-41b5-a35b-10515e0f6d37/blocks/236e5246-4da5-4680-834b-bea42eb5b3e4
 */

server.del(API_PREFIX + '/vm_block/:vm_lcuuid/blocks/:block_lcuuid', function (req, res, next){
    logger.debug('vm unplug block device', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var storage = new Storage();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(storage.unplugFromVm(req.params.vm_lcuuid,req.params.block_lcuuid, res_return))
        .then(storage.addPlugLog('', '虚拟机%s卸载云硬盘'))
        Q.resolve('', logger.info);
    }).catch(function(err){logger.error(err)});
});


//create backup spaces
/**
 * @api {patch} /backup-spaces/ Space Create
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParamExample {json} Request-Example
 * {
 *    "TOTAL_SIZE":150
 *    "USERID":2,
 *    "DOMAIN":"1234ae0e-a12a-42e3-a5df-99d87c453d20",
 *    "ORDER_ID":2,
 *    "PRODUCT_SPECIFICATION_LCUUID":"123456-100"
 * }
 */

server.post(API_PREFIX + '/backup-spaces/', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.create_spaces(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//modify backup spaces
/**
 * @api {patch} /backup-spaces/:lcuuid Space Modify
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {String} lcuuid The lcuuid of the space
 * @apiParamExample Url-Example
 * /backup-spaces/1
 * @apiParamExample {json} Request-Example
 * {
 *    "TOTAL_SIZE":150
 * }
 */

server.patch(API_PREFIX + '/backup-spaces/:lcuuid', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    data.lcuuid = req.params.lcuuid;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.modify_spaces(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//delete backup spaces
/**
 * @api {delete} /backup-spaces/:lcuuid Spaces Delete
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {String} lcuuid The lcuud of the space
 * @apiParamExample Url-Example
 * /backup-spaces/1234ae0e-a12a-42e3-a5df-99d87c453d20
 */

server.del(API_PREFIX + '/backup-spaces/:lcuuid', function (req, res, next){
    logger.debug('delete target is backup space', req.params);
    var data = {lcuuid:req.params.lcuuid, operator_name:get_authorization_username(req)};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.delete_spaces(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup spaces
/**
 * @api {get} /backup-spaces/ Spaces Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} order_id Orders unique id
 * @apiParam {String} domain The lcuud of the domain
 * @apiParamExample Url-Example
 * /backup-spaces/?userid=2&order_id=1&domain=1234ae0e-a12a-42e3-a5df-99d87c453d20
 */

server.get(API_PREFIX + '/backup-spaces/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_spaces(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup spaces
/**
 * @api {get} /backup-spaces/:lcuuid Spaces Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {String} lcuuid The lcuud of the space
 * @apiParamExample Url-Example
 * /backup-spaces/1234ae0e-a12a-42e3-a5df-99d87c453d20
 */

//get backup spaces used
/**
 * @api {get} /backup_spaces_used/ Spaces Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParamExample Url-Example
 * /backup-spaces-used/?userid=2
 */

server.get(API_PREFIX + '/backup-spaces-used/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_spaces_used(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


server.get(API_PREFIX + '/backup-spaces/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var data = {lcuuid:req.params.lcuuid};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_spaces(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


//create backup jobs
/**
 * @api {post} /backup-jobs/ Job Create
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParamExample {json} Request-Example
 * {
 *     "JOB_NAME": "ABC",
 *     "CLIENT_ID": 4,
 *     "PLAN_TYPE": "PER_DAY",
 *     "BACKUP_TYPE": "FULL_BACKUP",
 *     "SYS_TYPE":"TIME_BACKUP",
 *     "BEGIN_TIME":1384542000000000,
 *     "INTERVAL":1,
 *     "VALUE": 49,
 *     "DATA_SOURCES": [{"DISP_PATH": "home", "FULL_PATH": "/home"}],
 *     "JOB_TYPE": "FILE_SYSTEM",
 *     "ADV_PROPERTIES": [{"VALUE": "1", "KEY": "EEE_ROTATION_NUM"}],
 *     "USERID": 2
 * }
 */

server.post(API_PREFIX + '/backup-jobs/', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.create_jobs(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//modify backup jobs
/**
 * @api {put} /backup-jobs/:job_id Job Modify
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} job_id Jobs unique id
 * @apiParamExample Url-Example
 * /backup-jobs/1
 * @apiParamExample {json} Request-Example
 * {
 *     "JOB_NAME": "ABC",
 *     "CLIENT_ID": 4,
 *     "PLAN_TYPE": "PER_DAY",
 *     "BACKUP_TYPE": "FULL_BACKUP",
 *     "SYS_TYPE":"TIME_BACKUP",
 *     "BEGIN_TIME":1384542000000000,
 *     "INTERVAL":1,
 *     "VALUE": 49,
 *     "DATA_SOURCES": [{"DISP_PATH": "home", "FULL_PATH": "/home"}],
 *     "JOB_TYPE": "FILE_SYSTEM",
 *     "ADV_PROPERTIES": [{"VALUE": "1", "KEY": "EEE_ROTATION_NUM"}],
 *     "USERID": 2
 * }
 */

server.put(API_PREFIX + '/backup-jobs/:job_id', function (req, res, next){
    var data = req.body;
    data.job_id = req.params.job_id;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.modify_jobs(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup jobs
/**
 * @api {get} /backup-jobs/ Jobs Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} page_index Page index
 * @apiParam {Number} page_size Page size
 * @apiParamExample Url-Example
 * /backup-jobs/?userid=2&page_index=1&page_size=10
 */

server.get(API_PREFIX + '/backup-jobs/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_jobs(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err.stack)});
});

//get backup jobs
/**
 * @api {get} /backup-jobs/:id Jobs Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParamExample Url-Example
 * /backup-jobs/2
 */

server.get(API_PREFIX + '/backup-jobs/:id', function(req, res, next){
    logger.debug('request params is', req.params);
    var data = {id:req.params.id};
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_jobs(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//delete backup jobs
/**
 * @api {delete} /backup-jobs/ Jobs Delete
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} job_id Job unique id
 * @apiParamExample Url-Example
 * /backup-jobs/?userid=2&job_id=1
 */

server.del(API_PREFIX + '/backup-jobs/', function (req, res, next){
    logger.debug('delete target is jobs', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.delete_jobs(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//delete backup job datas
/**
 * @api {delete} /backup-job-datas/ Job datas Delete
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} job_id Job unique id
 * @apiParamExample Url-Example
 * /backup-job-datas/?userid=2&job_id=1
 */

server.del(API_PREFIX + '/backup-job-datas/', function (req, res, next){
    logger.debug('delete target is backup job datas', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.delete_job_datas(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup job backup histories
/**
 * @api {get} /job-backup-histories/ Job backup histories Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} page_index Page index
 * @apiParam {Number} page_size Page size
 * @apiParamExample Url-Example
 * /job-backup-histories/?userid=2&page_index=1&page_size=10
 */

server.get(API_PREFIX + '/job-backup-histories/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_job_backup_histories(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup job restore histories
/**
 * @api {get} /job-restore-histories/ Job restore histories Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} page_index Page index
 * @apiParam {Number} page_size Page size
 * @apiParamExample Url-Example
 * /job-restore-histories/?userid=2&page_index=1&page_size=10
 */

server.get(API_PREFIX + '/job-restore-histories/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_job_restore_histories(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//backup restores
/**
 * @api {post} /backup-restores/ Restores Create
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParamExample {json} Request-Example
 *
 *  {
 *      "JOB_TYPE": "MYSQL_DB",
 *      "JOB_ID": 42,
 *      "JOB_CID": "1B0C4188-ACFE-11E4-9FBF-0A1E4BD475C0",
 *      "CLIENT_ID": 5,
 *      "DESCRIPTION": "",
 *      "STRATEGY": 0,
 *      "DATA_DESTINATION": "/mysql20130/test-3",
 *      "TIME_POINT": "1423593938841538",
 *      "DATA_SOURCE": "/mysql20130/test",
 *      "USERID": 2
 *  }
 */

server.post(API_PREFIX + '/backup-restores/', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.create_restores(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup restore timepoints
/**
 * @api {get} /backup-restore-timepoints/ Backup restore timpoint Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {String} server_ip The ip address of the server
 * @apiParam {Number} job_cid Job unique id
 * @apiParam {Number} partial_sign Partial sign
 * @apiParamExample Url-Example
 * /backup-restore-timepoints/?userid=2&server_ip=1.1.1.1&job_cid=C1D0A044-AB6F-11E4-9FBF-0A1E4BD475C0&partial_sign=-1
 */

server.get(API_PREFIX + '/backup-restore-timepoints/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_restore_timepoints(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup restore timepoints
/**
 * @api {get} /backup-restore-timepoints/:timepoint Backup restore timpoint Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} timepoint The time point
 * @apiParam {String} server_ip The ip address of the server
 * @apiParam {Number} job_cid Job unique id
 * @apiParam {Number} partial_sign Partial sign
 * @apiParam {String} path The path for file
 * @apiParamExample Url-Example
 * /backup-restore-timepoints/1423161935287879/?userid=2&server_ip=1.1.1.1&job_cid=C1D0A044-AB6F-11E4-9FBF-0A1E4BD475C0&partial_sign=-1&path=/
 */

server.get(API_PREFIX + '/backup-restore-timepoints/:timepoint', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_restore_timepoints(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});


//authorization backup user
/**
 * @api {patch} /backup-authorization/ User Authorization
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParamExample Url-Example
 * /backup-authorization/2
 *  @apiParamExample {json} Request-Example
 *
 *  {
 *      "CLIENT_ID" : "5"
 *  }
 */

server.patch(API_PREFIX + '/backup-authorization/:userid', function(req, res, next){
    var data = req.body;
    data.userid = req.params.userid;
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.user_authorization(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup client data source
/**
 * @api {get} /client-data-sources/  Client data sources Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {String} ip The ip address of the vm
 * @apiParam {String} path The path of the data sources
 * @apiParamExample Url-Example
 * /backup-client-data-sources/?userid=2&ip=1.1.1.1&path=/
 */

server.get(API_PREFIX + '/backup-client-data-sources/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_client_data_sources(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup client
/**
 * @api {get} /backup-clients/ Clients Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {Number} page_index Page index
 * @apiParam {Number} page_size Page size
 * @apiParamExample Url-Example
 * /backup-clients/?userid=2&page_index=1&page_size=10
 *
 */

server.get(API_PREFIX + '/backup-clients/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_clients(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup has mysql on client
/**
 * @api {get} /backup-has-mysqlc-on-client/ Has mysqlc on client
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {String} client_mac The client MAC address
 * @apiParamExample Url-Example
 * /backup-has-mysqlc-on-client/?userid=2&client_mac=UOBIGUCD4CDNO7XL
 *
 */

server.get(API_PREFIX + '/backup-has-mysql-on-client/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_has_mysql_on_client(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//get backup mysql client paths
/**
 * @api {get} /backup-mysqlc-client-paths/ Mysqlc client paths Get
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParam {Number} userid Users unique id
 * @apiParam {String} client_mac The client MAC address
 * @apiParam {String} path The mysql path
 * @apiParamExample Url-Example
 * /backup-mysqlc-client-paths/?userid=2&client_mac=UOBIGUCD4CDNO7XL&path=
 *
 */

server.get(API_PREFIX + '/backup-mysql-client-paths/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.get_mysql_client_paths(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//add auth mysqlc
/**
 * @api {post} /add-auth-mysql/ Restores Create
 * @apiVersion 3.4.0
 * @apiGroup backup
 * @apiParamExample {json} Request-Example
 *
 *  {
 *      "USERID": 2
 *      "CLIENT_MAC": "UOBIGUCD4CDNO7XL",
 *      "DISP_PATH": "mysql20130",
 *      "PORT": "3306",
 *      "USER_NAME": "root",
 *      "PASSWORD": "XXXXX"
 *  }
 */

server.post(API_PREFIX + '/add-auth-mysql/', function(req, res, next){
    var data = req.body;
    data.operator_name = get_authorization_username(req);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.add_auth_mysql(data, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

//check auth mysql
/**
 * @api {get} /check-auth-mysql/ mysqlc client paths get
 * @apiversion 3.4.0
 * @apiGroup backup
 * @apiParam {number} userid users unique id
 * @apiParam {string} client_mac the client mac address
 * @apiParamexample url-example
 * /check-auth-mysql/?userid=2&client_mac=uobigucd4cdno7xl&disp_path=mysql20130&port=3306&user_name=root&password=xxxxx
 *
 */

server.get(API_PREFIX + '/check-auth-mysql/', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var backup = new Backup();
        backup.check_auth_mysql(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {post} /vl2s/:lcuuid/extension/:portgrouplcuuid vl2 extend portgroup
 * @apiversion  4.0.0
 * @apiGroup portgroup
 * @apiParam {string} lcuuid  lcuuid of vl2 to extend
 * @apiParam {string} portgrouplcuuid lcuuid of portgroup
 * @apiParamexample url-example
 * /vl2s/xxxx-xxx-xxx-xxxx/extension/xxxx-xxx-xxx-xxxx
 *
 */
server.post(API_PREFIX + '/vl2s/:lcuuid/extension/:vmwarelcuuid', function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var pack = new Pack();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(pack.postPortGroupConnection(
            {
                type:'VMWARE',
                vl2_lcuuid: req.params.lcuuid,
                vmware_port_group_lcuuid: req.params.vmwarelcuuid
            },
        res_return))
        //.then(storage.addPlugLog('', '虚拟机%s卸载云硬盘'))
        Q.resolve('');
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {delete} /vl2s/:lcuuid/extension/:portgrouplcuuid  delete vl2 extend portgroup
 * @apiversion  4.0.0
 * @apiGroup portgroup
 * @apiParam {string} lcuuid  lcuuid of vl2 to extend
 * @apiParam {string} portgrouplcuuid lcuuid of portgroup
 * @apiParamexample url-example
 * /vl2s/xxxx-xxx-xxx-xxxx/extension/xxxx-xxx-xxx-xxxx
 *
 */
server.del(API_PREFIX + '/vl2s/:lcuuid/extension/:portgrouplcuuid', function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var pack = new Pack();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(pack.delPortGroupConnection(
            {
                vl2_lcuuid: req.params.lcuuid,
                vmware_port_group_lcuuid: req.params.portgrouplcuuid
            },
        res_return))
        //.then(storage.addPlugLog('', '虚拟机%s卸载云硬盘'))
        Q.resolve('');
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {get} /dump-status/ get running jobs in APP
 * @apiversion  4.0.0
 * @apiGroup APP
 * @apiParamexample url-example
 * /dump-status/
 */
server.get(API_PREFIX + '/dump-status/', function(req, res, next){
    var instanceStatus = Instance.container;
    var potStatus = instancePot._actionContainer;
    res.send(200, JSON.stringify({'old_version_task': instanceStatus, 'new_version_task': potStatus}));
    res.end();
    return next();
});

/**
 * @api {get} /pack-pool
 * @apiVersion 4.0.0
 * @apiDescription Get pack-pool name and type
 * @apiGroup 2Cloud Pack
 */
server.get(API_PREFIX + '/pack-pool', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var pack = new Pack();
        pack.get_pack_pool(req.params, res_return, res_return);
    }).catch(function(err){util.error(err)});
})

/**
 * @api {get} /pack-pool-info
 * @apiVersion 4.0.0
 * @apiDescription get pack-pool info
 * @apiGroup 2Cloud Pack
 */
server.get(API_PREFIX + '/pack-pool-info', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var pack = new Pack();
        pack.get_pack_pool_info(req.params, res_return, res_return);
    }).catch(function(err){util.error(err)});
})

/**
 * @api {get} /portgroups
 * @apiVersion 4.0.0
 * @apiDescription Get VMware portgroups info
 * @apiGroup portgroup
 */
server.get(API_PREFIX + '/portgroups', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var pack = new Pack();
        pack.get_portgroups(req.params, res_return, res_return);
    }).catch(function(err){util.error(err)});
})

/**
 * @api {patch} /portgroup/lcuuid
 * @apiVersion 4.0.0
 * @apiDescription Patch VMware portgroup
 * @apiGroup portgroup
 */
server.patch(API_PREFIX + '/portgroup/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var data = req.body;
    data.lcuuid = req.params.lcuuid;
    atry(function(){
        var pack = new Pack();
        pack.patch_portgroup(data, res_return, res_return);
    }).catch(function(err){util.error(err)});
})

/**
 * @api {get} /pg-vms/lcuuid
 * @apiVersion 4.0.0
 * @apiDescription Get VMs by VMware portgroup
 * @apiGroup portgroup
 */
server.get(API_PREFIX + '/pg-vms/:lcuuid', function(req, res, next){
    logger.debug('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var pack = new Pack();
        pack.get_vms_by_portgroup(req.params, res_return, res_return);
    }).catch(function(err){util.error(err)});
})

/**
 * @api {patch} /v2/third-party-devices/:lcuuid change powerstate of third_party_device
 * @apiversion  4.0.0
 * @apiGroup bare metal
 * @apiParam {string} lcuuid  lcuuid of third_party_device
 * @apiParamExample {json} Request-Example
 * {
 *  state: 1, //启动
 *  state: 2  //停止
 * }
 *
 */
server.patch(API_PREFIX_V2 + '/third-party-devices/:lcuuid', function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var hw = new ThirdHW();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(hw.changeState(
           req.params.lcuuid, req.body.state, res_return))
        Q.resolve('');
    }).catch(function(err){logger.error(err)});
})

server.del(API_PREFIX_V4_1+'/third-party-devices/:lcuuid', function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var hw = new ThirdHW();
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.then(hw.del(
           req.params.lcuuid, res_return))
        Q.resolve('');
    }).catch(function(err){logger.error(err)});

})



server.get(/^\/v1\/azure-([^\/?]*)$/, function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var azure = new Azure();
        azure.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.get(/^\/v1\/azure-([^\/?]*)\/([a-zA-Z0-9-]+)/, function(req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var azure = new Azure();
        azure.get(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.post(/^\/v1\/azure-([^\/?]*)/, function(req, res, next){
    logger.info('request params is', req.params);
    logger.info('request body is', req.body);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var azure = new Azure();
        azure.create(req.body, req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

server.del(/^\/v1\/azure-([^\/?]*)\/([a-zA-Z0-9-]+)/, function (req, res, next){
    logger.info('request params is', req.params);
    var res_return = gen_res_return(res, next);
    atry(function(){
        var azure = new Azure();
        azure.del(req.params, res_return, res_return);
    }).catch(function(err){logger.error(err)});
});

/**
 * @api {get} /v4.2/physical-topologies GET physical topology
 * @apiDescription 获取云平台所有设备的全局拓扑信息。
 * 这些拓扑信息包括vswitch和虚拟设备的连接关系，以及physical switch的LLDP信息。
 * @apiGroup torswitch
 */
server.get(API_PREFIX_V4_2 + '/physical-topologies', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var params = req.params
    var Q = Api.callTalker('GET', '/v1/physical-topologies/', params,
        function(ans){res_return(ans.body)});
    Q.setRejectHandler(res_return);
    Q.resolve();
});

/**
 * @api {get} /v4.1/torswitches/ Get ToR switches
 * @apiName get_torswitches
 * @apiVersion 4.1.0
 * @apiDescription get all torswitches
 * @apiGroup torswitch
 */
server.get(API_VERSION_V4_1+'/torswitches/', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var params = req.params
    var Q = Api.callTalker('GET', '/v1/torswitches/', params,
        function(ans){res_return(ans.body)});
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {get} /v4.1/torswitches/:lcuuid Get ToR switch
 * @apiName get_torswitch
 * @apiVersion 4.1.0
 * @apiDescription get torswitches by lcuuid
 * @apiGroup torswitch
 */
server.get(API_VERSION_V4_1+'/torswitches/:lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var Q=Api.callTalker('GET', '/v1/torswitches/'+req.params.lcuuid, params,
        function(ans){res_return(ans.body)});
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {get} /v4.1/instances/ get instances
 * @apiName get_instances
 * @apiVersion 4.1.0
 * @apiDescription get all instances
 * @apiGroup instance
 */
server.get(API_VERSION_V4_1+'/instances/', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var params = req.params
    var Q = Api.callTalker('GET', '/v1/instances/', params,
        function(ans){res_return(ans.code, ans.body)})
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {get} /v4.1/micro-segments/ get ms flows
 * @apiName get_ms
 * @apiVersion 4.1.0
 * @apiDescription get ms
 * @apiGroup micro-segments
 * @apiParamExample {json} Request-Example
 * {
 *  type: 'HOST',
 *  vl2_lcuuid: 'xxx-xxx-xxx',
 *  isp_lcuuid: 'xxx-xxx-xxx',
 *  epc_id: 'xxx-xxx-xxx',
 * }
 */
server.get(API_VERSION_V4_1+'/micro-segments/', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var params = req.params
    var Q = Api.callTalker('GET', '/v1/micro-segments/', params, function(ans){
        res_return(ans.code, ans.body);
    })
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {get} /v4.1/micro-segments/:lcuuid get ms
 * @apiName get_ms
 * @apiVersion 4.1.0
 * @apiDescription get ms
 * @apiGroup micro-segments
 */
server.get(API_VERSION_V4_1+'/micro-segments/:lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var Q = Api.callTalker('GET', '/v1/micro-segments/'+req.params.lcuuid, '', function(ans){
        res_return(ans.code, ans.body);
    })
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {post} /v4.1/micro-segments/:lcuuid post ms
 * @apiName create_ms
 * @apiVersion 4.1.0
 * @apiDescription transparent api to talker
 * @apiGroup micro-segments
 */
server.post(API_VERSION_V4_1+'/micro-segments/', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var params = lc_utils.mergeObject(req.params, req.body ? req.body : {});
    var Q = Api.callTalker('POST', '/v1/micro-segments/', params, function(ans){
        res_return(ans.code, ans.body);
    })
    Q.setRejectHandler(res_return);
    Q.resolve();
})
/**
 * @api {post} /v4.1/micro-segments/:lcuuid/interfaces/ add interfaces to ms
 * @apiName create_ms
 * @apiVersion 4.1.0
 * @apiDescription transparent api to talker
 * @apiGroup micro-segments
 */
server.post(API_VERSION_V4_1+'/micro-segments/:lcuuid/interfaces', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var params = req.body;
    var Q = Api.callTalker('POST', '/v1/micro-segments/'+req.params.lcuuid+'/interfaces/', params, function(ans){
        res_return(ans.code, ans.body);
    })
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {del} v4.1/micro-segments/:lcuuid del ms
 * @apiName del_ms
 * @apiVersion 4.1.0
 * @apiDescription del ms
 * @apiGroup micro-segments
 */
server.del(API_VERSION_V4_1+'/micro-segments/:lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var Q = Api.callTalker('DEL', '/v1/micro-segments/'+req.params.lcuuid, '', function(ans){
        res_return(ans.code, ans.body);
    })
    Q.setRejectHandler(res_return);
    Q.resolve();
})

/**
 * @api {get} v4.1/micro-segment-flows/ get ms flows
 * @apiName get_ms_flows
 * @apiVersion 4.1.0
 * @apiDescription get flow of two ms
 * @apiGroup micro-segments
 * @apiParamExample {json} Request-Example
 *
 * get vl2 east-west flows
 * {
 *  epc_id: 2,
 *  vl2_lcuuid: '052490c0-fd31-4d91-ae2b-9f79dba3a817',
 * }
 *
 * get east-west flow
 * {
 *  src_ms_lcuuid: '052490c0-fd31-4d91-ae2b-9f79dba3a815',
 *  dst_ms_lcuuid: '052490c0-fd31-4d91-ae2b-9f79dba3a814',
 *  epc_id: 2
 * }
 *
 * get north-south flow
 * {
 *  isp_lcuuid: '052490c0-fd31-4d91-ae2b-9f79dba3a816',
 *  vl2_lcuuid: '052490c0-fd31-4d91-ae2b-9f79dba3a817',
 *  epc_id: 2
 * }
 *
 */
server.get(API_VERSION_V4_1+'/micro-segment-flows/', function(req, res, next){
    var pre_res_return = gen_res_return(res, next);
    var params = req.params
    var operator_name = get_authorization_username(req);
    atry(function(){
        var Q = new flow.Qpack(flow.serial);
        var res_return = function(){
            pre_res_return.apply(Q, arguments); Q._dump('get_flow', {timeline: 1});
        }
        Q._requestId = res.apiuuid;
        Q.setData('operatorName', operator_name);
        Q.setRejectHandler(res_return);
        Q.then(ms.getChain(params, res_return));
        Q.resolve('');
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {post} v4.1/micro-segment-flows/ post ms flows
 * @apiName post_ms_flows
 * @apiVersion 4.1.0
 * @apiDescription create east-west or south-north flow
 * @apiGroup micro-segments
 * @apiParamExample {json} Request-Example
 *
 * create vl2 east-west flow
 * {
 *  "EPC_ID": 123,
 *  "VL2_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a817",
 *  "SRC_MS_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a815",
 *  "DST_MS_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a814",
 *  "SERVICES": [
 *    {
 *      "ACLS": [
 *        {
 *          "PROTOCOL": "0 for any protocol",
 *          "PROTOCOL": 6,
 *          "PROTOCOL": "0 for any dst_port",
 *          "DST_PORT": 80
 *        }
 *      ],
 *      "INSTANCE_TYPE": "`VM', `VGATEWAY'",
 *      "INSTANCE_TYPE": "VM",
 *      "INSTANCE_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a817",
 *    }
 *  ]
 *}
 * create isp-vl2 north-south flow
 * {
 *  "EPC_ID": 123,
 *  "ISP_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a816",
 *  "VL2_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a799",
 *  "SERVICES": [
 *    {
 *      "ACLS": [
 *        {
 *          "PROTOCOL": "0 for any protocol",
 *          "PROTOCOL": 6,
 *          "PROTOCOL": "0 for any dst_port",
 *          "DST_PORT": 80
 *        }
 *      ],
 *      "INSTANCE_TYPE": "`VM', `VGATEWAY'",
 *      "INSTANCE_TYPE": "VM",
 *      "INSTANCE_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a817",
 *      "IS_L3": "配置公网IP的设备此值为true，其他设备没有此值",
 *    }
 *  ]
 *  "PUBLIC_IP_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a867",
 *  "BANDWIDTH": "公网带宽",
 *}
 * create isp-isp transparent flow
 * {
 *  "EPC_ID": 123,
 *  "ISP_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a816",
 *  "SERVICES": [
 *    {
 *      "ACLS": [
 *        {
 *          "PROTOCOL": "0 for any protocol",
 *          "PROTOCOL": 6,
 *          "PROTOCOL": "0 for any dst_port",
 *          "DST_PORT": 80
 *        }
 *      ],
 *      "INSTANCE_TYPE": "VM",
 *      "INSTANCE_LCUUID": "052490c0-fd31-4d91-ae2b-9f79dba3a817",
 *    }
 *  ]
 * }
 */
server.post(API_VERSION_V4_1+'/micro-segment-flows/', function(req, res, next){
    var pre_res_return = gen_res_return(res, next);
    var params = req.body
    var operator_name = get_authorization_username(req);
    atry(function(){
        var Q = new flow.Qpack(flow.serial);
        var res_return = function(){
            pre_res_return.apply(Q, arguments); Q._dump('post_flow', {timeline: 1});
        }
        Q.setData('operatorName', operator_name);
        Q._requestId = res.apiuuid;
        if (('ISP_LCUUID' in params) && ('VL2_LCUUID' in params)){
            Q.then(ms.createSouthNorthChain(params, res_return));
        } else if ('ISP_LCUUID' in params) {
            Q.then(ms.createDirectL3Chain(params, res_return));
        } else {
            Q.then(ms.createChain(params, res_return));
        }
        Q.resolve('', function(){});
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {del} /v4.1/micro-segment-flows/:lcuuid delete a plain flow
 * @apiversion  4.1.0
 * @apiGroup micro-segments
 * @apiDescription do not use this api. POST an empty service-nodes array to flow to delete.
 */
server.del(API_VERSION_V4_1+'/micro-segment-flows/:lcuuid', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.setRejectHandler(res_return);
        Q.then(ms.delChain(req.params.lcuuid, res_return));
        Q.resolve('');
    }).catch(function(err){logger.error(err)});
})

/**
 * @api {del} /v4.1/sn-micro-segment-flows/:lcuuid delete south-north flow
 * @apiversion  4.1.0
 * @apiGroup micro-segments
 */
server.del(API_VERSION_V4_1+'/sn-micro-segment-flows/', function(req, res, next){
    var res_return = gen_res_return(res, next);
    var operator_name = get_authorization_username(req);
    atry(function(){
        var Q = new flow.Qpack(flow.serial);
        Q.setData('operatorName', operator_name);
        Q.setRejectHandler(res_return);
        Q.then(ms.delSouthNorthChain(req.body, res_return));
        Q.resolve('');
    }).catch(function(err){logger.error(err)});
})


/*************process setting************/
process.on ('SIGINT', function(){
    console.log('Got STDINT, exit');
    process.exit();
})

process.on('exit', function(code){
    console.log('app exit with code', code);
})

process.on('uncaughtException', function(err){
    console.log(err.stack);
})

