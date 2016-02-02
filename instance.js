var logger = require('./logger.js');
var flow = require('./flow.js');
var operationLog = require('./operation_log.js');
var Zet = {};
Zet.thirdhw = require('./third_party_device.js');
Zet.vgateway = require('./vgateway.js');
Zet.valve = require('./valve.js');
Zet.vm = require('./vm.js');
Zet.vgw = require('./vgw.js');
Zet.vl2 = require('./vl2.js');
Zet.vdisk = require('./vdisk.js');
Zet.balance = require('./balance.js');
Zet.order = require('./order.js');
var util = require('util');
var obj = require('./obj.js');
var lc_utils = require('./lc_utils.js');

var ThirdHW = Zet.thirdhw;
var Vgateway = Zet.vgateway;
var Valve = Zet.valve;
var Vm = Zet.vm;
var Vgw = Zet.vgw;
var Vl2 = Zet.vl2;
var Vdisk = Zet.vdisk;
var Balance = Zet.balance;
var Order = Zet.order;

var Instance ={
    container : {},
    getObj : function(type, errorcallback, action){return function(data ,f){
        logger.debug('execute getObj', data);
        data = lc_utils.lowerJsonKey(data);
        type = type.toLowerCase();
        if ('ID' in data) data.id = data.ID;
        if (['thirdhw', 'vm', 'vgateway', 'vgw','valve', 'vl2', 'vdisk'].indexOf(type) == -1){
            errorcallback('invalid type');
        } else if ('id' in data){
            if (((type+data.id) in Instance.container)){
                delete Instance.container[type+data.id];
            }
            if (type == 'thirdhw')
                Instance.container['thirdhw'+data.id] = new ThirdHW();
            else if (type == 'vgateway')
                Instance.container['vgateway'+data.id] = new Vgateway();
            else if (type == 'valve')
                Instance.container['valve'+data.id] = new Valve();
            else if (type == 'vm')
                Instance.container['vm'+data.id] = new Vm();
            else if (type == 'vl2')
                Instance.container['vl2'+data.id] = new Vl2();
            else if (type == 'vgw') {
                Instance.container['vgw'+data.id] = new Vgw();
            } else if (type == 'vdisk') {
                Instance.container['vdisk'+data.id] = new Vdisk();
            }
            logger.info('instance is', Instance.container);
            Instance.container[type+data.id].refCount = 0;

            Instance.data = {};
            Instance.container[type+data.id].setData(data);
            if (action){
                Instance.container[type+data.id].action = action;
            }
            Instance.container[type+data.id].refCount ++;
            f(Instance.container[type+data.id]);
        }else{
            errorcallback('id not in data');
        }
    }},
    bindEvent : function(e, callback, errorcallback){return function(a, f){
        logger.debug('execute bindEvent', a);
        if (a.listeners(e).length > 0){
            errorcallback(a)('another '+e+' of this obj is running!');
            f(a);
        } else{
            a.on(e, callback);
            f(a);
        }
    }},
    update: function(type, callback, errorcallback){
        return function(a, f){
            logger.debug('execute update', a);
            var newcallback = function(d){
                console.log(d);
                if ('OPT_STATUS' in d && d.OPT_STATUS == 'SUCCESS'){
                    callback(d);
                } else{
                    errorcallback('OPT_STATUS shows failed status');
                }
                f(a);
            }
            var newerrorcallback = function(d){
                errorcallback(d);
                f(a);
            }
            if (type == 'thirdhw')
                var b = new ThirdHW();
            else if (type == 'vgateway')
                var b = new Vgateway();
            else if ( type == 'valve')
                var b = new Valve();
            else if (type == 'vm')
                var b = new Vm();
            else if (type == 'vl2')
                var b = new Vl2();
            else if (type == 'vgw')
                var b = new Vgw();
            else if (type == 'vdisk')
                var b = new Vdisk();
            else
                errorcallback('invalid type');
            return b.update(a.data, newcallback, newerrorcallback);

        }
    },
    execute : function(action){
        return function(type, callback, errorcallback){
            return function(a, f){
                logger.debug('execute '+action, a);
                var newcallback = function(d){
                    logger.info(d);
                    if ('OPT_STATUS' in d && d.OPT_STATUS == 'SUCCESS'){
                        callback(d);
                    } else{
                        errorcallback('OPT_STATUS shows failed status');
                    }
                    f(a);
                }
                var newerrorcallback = function(d,r){
                    errorcallback(d,r);
                    f(a);
                    Instance.clean(a, function(){});
                }
                return a[action](a.data_diff, newcallback, newerrorcallback);
            }
        }

    },
    start: function(type, callback, errorcallback){
        return function(a, f){
            logger.debug('execute start', a);
            var newcallback = function(d){
                console.log(d);
                if ('OPT_STATUS' in d && d.OPT_STATUS == 'SUCCESS'){
                    callback(d);
                } else{
                    errorcallback('OPT_STATUS shows failed status');
                }
                f(a);
            }
            var newerrorcallback = function(d){
                errorcallback(d);
                f(a);
            }
            if (type == 'thirdhw')
                var b = new ThirdHW();
            else if (type == 'vgateway')
                var b = new Vgateway();
            else if (type == 'valve')
                var b = new Valve();
            else if (type == 'vm')
                var b = new Vm();
            else if (type == 'vl2')
                var b = new Vl2();
            else if (type == 'vgw')
                var b = new Vgw();
            else if (type == 'vdisk')
                var b = new Vdisk();
            else
                errorcallback('invalid type');
            return b.start(a.data, newcallback, newerrorcallback);

        }
    },
    del: function(type, callback, errorcallback){
        return function(a, f){
            logger.debug('execute del', a);
            var newcallback = function(d){
                console.log(d);
                if ('OPT_STATUS' in d && d.OPT_STATUS == 'SUCCESS'){
                    callback(d);
                } else{
                    errorcallback('OPT_STATUS shows failed status');
                }
                f(a);
            }
            var newerrorcallback = function(d){
                errorcallback(d);
                f(a);
            }
            if (type == 'thirdhw')
                var b = new ThirdHW();
            else if (type == 'vgateway')
                var b = new Vgateway();
            else if (type == 'valve')
                var b = new Valve();
            else if (type == 'vm')
                var b = new Vm();
            else if (type == 'vl2')
                var b = new Vl2();
            else if (type == 'vgw')
                var b = new Vgw();
            else if (type == 'vdisk')
                var b = new Vdisk();
            else
                errorcallback('invalid type');
            return b.del(a.data, newcallback, newerrorcallback);
        }
    },
    get: function(type, callback, errorcallback){
        return function(a, f){
            logger.debug('execute del', a);
            var newcallback = function(d){
                console.log(d);
                if ('OPT_STATUS' in d && d.OPT_STATUS == 'SUCCESS'){
                    callback(d);
                } else{
                    errorcallback('OPT_STATUS shows failed status');
                }
                f(a);
            }
            var newerrorcallback = function(d){
                errorcallback(d);
                f(a);
            }
            if (type == 'balance')
                var b = new Balance();
            else
                errorcallback('invalid type');
            return b.get(a.data, newcallback, newerrorcallback);
        }
    },

    create : function(type, callback, errorcallback){
        return function(a, f){
            logger.debug('execute create', a);
            var newcallback = function(d){
                console.log(d);
                if ('OPT_STATUS' in d && d.OPT_STATUS == 'SUCCESS'){
                    callback(d);
                    if (d.DATA.constructor == Array)
                        f(d.DATA[0]);
                    else
                        f(d.DATA);
                } else{
                    errorcallback('OPT_STATUS shows failed status');
                    Instance.clean(a);
                    f(d);
                }
            }
            var newerrorcallback = function(d){
                errorcallback.apply(this, Array.prototype.splice.call(arguments, 0));
                Instance.clean(a, function(){f(d)});
            }
            if (type == 'thirdhw')
                var b = new ThirdHW();
            else if (type == 'vgateway')
                var b = new Vgateway();
            else if (type == 'valve')
                var b = new Valve();
            else if (type == 'vm')
                var b = new Vm();
            else if (type == 'vl2')
                var b = new Vl2();
            else if (type == 'vgw')
                var b = new Vgw();
            else if (type == 'vdisk')
                var b = new Vdisk();
            else
                errorcallback('invalid type');
            return b.create(a, newcallback, newerrorcallback);
        }
    },
    changeState : function(callback){
        return function(a, f){
            logger.info('starting vm' + a.data.id);
            Instance.sendData('patch', {'state':a.state.STARTING}, function(sCode, a){callback(sCode, a.data), f(a)});
        }
    },
    snapshot : function(){

    },
    waitFor : function(e){return function(a, f){
        logger.info('waiting for ', e);
        a.event_handler[e] = function(){f(a); a=null;};
    }},
    writeToSql : function(a, f){
        logger.info(a);
        a.writeToSql(function(){a.data_diff={}; f(a)});
    },
    removeTrigger : function(e, event_listener){
        return function(a, f){
            logger.info('remove registerTrigger', a);
            event_listener.removeTrigger(a.type, a.data.id);
        }
    },
    registerTrigger : function(e, event_check, event_listener, errorcallback){
        return function(a, f){
            logger.info('execute registerTrigger', a);
            logger.info("in registerTrigger", JSON.stringify(a.data));
            //if('ORDER_ID' in a.data){
            //    a.data.id = a.data.ORDER_ID;
            //}
            if (a.type != 'vl2'){
                event_listener.addTrigger(
                    a.type,
                    a.data.id,
                    function(data, cleanMAP){
                        if ('OPT_STATUS' in data && event_check(data.DATA)){
                            a.setData(data.DATA);
                            a.default_event_parser(data.DATA, function(){cleanMAP();a.emit(e)}, errorcallback);
                        } else{
                            logger.info('data failed to match a trigger', data);
                            cleanMAP();
                            errorcallback(500);
                        }
                        var output = {ACTION:e, OPT_STATUS:data.OPT_STATUS}
                    }
                );
            } else{
                event_listener.addTrigger(
                    a.type,
                    a.data.lcuuid,
                    {
                        target : a,
                        opt : function(data, cleanMAP){
                            logger.info('opt running', data);
                            if ('OPT_STATUS' in data && event_check(data.DATA)){
                                a.setData(data.DATA);
                                a.default_event_parser(data.DATA, function(){cleanMAP();a.emit(e)}, errorcallback);
                            } else{
                                logger.info('data failed to match a trigger', data);
                                cleanMAP();
                                errorcallback(500);
                            }
                            var output = {ACTION:e, OPT_STATUS:data.OPT_STATUS}
                        }
                    }
                );
            }
            f(a);
        }
    },
    clean : function(a, f){
        //logger.info(Instance.container);
        if (a && 'data' in a && 'id' in a.data) {
            logger.info('object '+(a.type+a.data.id)+' refCount: ', Instance.container[a.type+a.data.id].refCount)
            if (Instance.container[a.type+a.data.id].refCount == 1){
                logger.info('clean the object');
                Instance.container[a.type+a.data.id] = null;
                delete(Instance.container[a.type+a.data.id]);
            } else{
                Instance.container[a.type+a.data.id].refCount --;
            }
        }
        f(a);
        a = null;
    },

    event_parser: function(){
        var _MAP = {};
        var _msgQueue = [];
        // if msg exist in _msgQueue
        var dealMsgFlag= false;
        var _msgContainer = {};
        var deal = '';
        var getKey = function(msg){
            return msg['TYPE']+msg.DATA['LCUUID'];
        }
        var replaceObj = function(obj, data){
            for (var i in data){
                obj[i] = data[i];
            }
            for (var j in obj){
                if (!(j in data)){
                    delete(obj[j])
                }
            }
        }
        var addMsg = function(data){
            if ('TYPE' in data && 'LCUUID' in data.DATA && ['VM', 'VGATEWAY', 'VGW', 'VALVE', 'VL2', 'VDISK'].indexOf(data.TYPE) != -1){
                //ignore snapshot msgs, these msgs will be handled in instancePot;
                if ('SNAPSHOTS' in data){
                    return;
                }
                var key = getKey(data);
                if (key in _msgContainer){
                    logger.info('queue msg reset ', key, data);
                    replaceObj(_msgContainer[key], data);
                } else{
                    _msgContainer[key] = data;
                    _msgQueue.push(data);
                }
                logger.info('add to queue ', data);
            } else{
                return;
               // deal(data, function(){});
            }
            logger.info('queue length is ', _msgQueue.length);
            if (_msgQueue.length && dealMsgFlag == false){
                dealMsgFlag = true;
                setTimeout(dealMsg, 0);
            }
        }
        var dealMsg = function(){
            var runner = function(){
                logger.info('queue length is ', _msgQueue.length);
                if (_msgQueue.length){
                    var data = popMsg();
                    logger.info('queue dealing with ', data);
                    deal(data, function(){
                        runner();
                    })
                } else{
                	dealMsgFlag =false;
                }
            }
            runner();
        }
        var popMsg = function(){
            var msg = _msgQueue.shift();
            delete(_msgContainer[getKey(msg)]);
            return msg;
        }
        var deal = function(data, callback){
            //logger.info('mapping the event listened', data, _MAP);
            //_MAP[0][1]();
            logger.info('map is', _MAP)
            logger.info('data is', data)
            var ps = '';
            if (data["TYPE"] == 'HADisk'){
                data["TYPE"] = 'vdisk';
            }
            if (data.DATA.type == 'balance') {
                var a = new Balance();
                //b.default_event_parser(data, logger.info, logger.info);
                if ((a.type+data.DATA.id) in _MAP){
                    _MAP[a.type+data.DATA.id](data, function(){
                        logger.info('cleaning _MAP of '+a.type+data.DATA.id);
                        delete(_MAP[a.type+data.DATA.id]);
                        logger.info('_MAP after clean', _MAP);
                    });
                }
            }

            if (data.DATA.type == 'LbBkVM') {
                var msg = {
                    type : 'user',
                    target : data.DATA.userid,
                    msg : {
                        action : 'update',
                        state : 'done',
                        type : 'lb_bk_vm',
                        id : data.DATA.lcuuid,
                        data : {health_state:data.DATA.health_state}
                    }
                };
                obj.prototype.sendToMsgCenter(msg);
            }
            if (data["TYPE"].toLowerCase() in Zet){
            var a = new Zet[data["TYPE"].toLowerCase()]();

            data = a.parseBdbToFdbData(data);

            if (data.TYPE == 'vdisk'){
                ps = [a.tableName, 'lcuuid', data.DATA.vm_lcuuid];
            } else{
                ps = [a.tableName, 'lcuuid', data.DATA.lcuuid];
            }

            if (data.TYPE != 'VL2'){
                a.selectSql(ps,
                    function(ans){
                        if (ans.length > 0){
                            data.DATA.id = ans[0].id;
                            //update log
                            if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS'){
                                operationLog.update({objecttype:a.type, objectid:data.DATA.id, opt_result:1});
                            } else{
                                operationLog.update({objecttype:a.type, objectid:data.DATA.id, opt_result:2, error_code:data.OPT_STATUS});
                            }

                            if ((a.type+data.DATA.id) in _MAP){
                                _MAP[a.type+data.DATA.id](data, function(){
                                    logger.info('cleaning _MAP of '+a.type+data.DATA.id);
                                    delete(_MAP[a.type+data.DATA.id]);
                                    logger.info('_MAP after clean', _MAP);
                                    callback()
                                });
                            } else{
                                logger.info('unexpected msg received');
                                a.setData(data.DATA);
                                a.default_event_parser(data, callback, logger.info);
                            }
                            logger.info(_MAP);
                        } else{
                            a.action == 'enforce_sync';
                            logger.info('lcuuid '+a.type+' '+data.DATA.lcuuid+' not found');
                            callback();
                        }
                    }
                )
            }
            else{
                if ((a.type+data.DATA.lcuuid) in _MAP){
                    var b = _MAP[a.type+data.DATA.lcuuid];
                    if ('OPT_STATUS' in data && data.OPT_STATUS == 'SUCCESS'){
                        operationLog.update({objecttype:a.type, objectid:b.target.data.id, opt_result:1});
                    } else{
                        operationLog.update({objecttype:a.type, objectid:b.target.data.id, opt_result:2, error_code:data.OPT_STATUS});
                    }
                    logger.info(b);
                    b.opt(data, function(){
                        logger.info('cleaning _MAP of '+a.type+data.DATA.lcuuid);
                        delete(_MAP[a.type+data.DATA.lcuuid]);
                        logger.info('_MAP after clean', _MAP);
                        callback();
                    });
                } else{
                    logger.info('unexpected msg received');
                    a.setData(data.DATA);
                    a.default_event_parser(data, callback, logger.info);
                }
            }

            }

        }

        return {
            map: function(data){
                if ('TYPE' in data && 'LCUUID' in data.DATA
                && ['THIRDHW', 'BLOCK_DEVICE', 'VM_SNAPSHOT', 'VM_BLOCK'].indexOf(data.TYPE) == -1){
                    logger.info("dgram listener received data", data);
                    addMsg(data);
                }
            },
            getTaskId : function(){},
            addTrigger : function(type, id, callback){
                _MAP[type.toLowerCase()+id] = callback;
                //_MAP.push([id, callback]);
                logger.debug('_MAP after register', _MAP);
            },
            removeTrigger : function(type, id){
                var key = type.toLowerCase()+id;
                if (key in _MAP){
                    delete(_MAP[key]);
                }
            },
        };
    },
    url_parser : function(){
        return function(){};
    }
}

//test
//new flow.serial([Instance.getObj, Instance.create(function(a){console.log('fd', a)}), new flow.parallel([new flow.serial([Instance.check, Instance.report, Instance.clean]), Instance.trigger])]).fire({id:1}, function(a){console.log(a[0].data)});
//console.log(Vm.prototype);
module.exports = Instance;
