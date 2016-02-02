var EventEmitter = require('events').EventEmitter;
var logger = require('./logger.js');
/*
 * new APP's instace state keeper
 */

/*  Pot structure:
 *  {
 *      uuid: {
 *          action : {
 *              type:,
 *              name:,
 *              uuid:,
 *              state:,
 *              action:,
 *          }
 *      }
 *  }
 */
var db = require('./db.js');
var lc_utils = require('./lc_utils.js');

var Pot = {
    _event: new EventEmitter(),
    _actionContainer: {},
    _taskContainer: {},
    _enforceSyncQueue: [],
    _enforceSyncContainer: {},
    replaceObj: function(obj, data){
        for (var i in data){
            obj[i] = data[i];
        }
        for (var j in obj){
            if (!(j in data)){
                delete(obj[j])
            }
        }
    },
    trigger: function(type, action, data){
        switch(type){
            case 'BLOCK_DEVICE':
                if (action == 'enforSync'){
                    db.update('block_device', {data: data, cond:{'lcuuid': data.LCUUID}}).resolve();
                    return true;
                }
        }
        if (data.LCUUID in Pot._actionContainer && action in Pot._actionContainer[data.LCUUID])
            delete Pot._actionContainer[data.LCUUID][action];
    },
    storeTask: function(taskId, func){
        if (taskId in Pot._taskContainer) {
            throw new Error('taskId is occupyed!');
        } else {
            Pot._taskContainer[taskId] = 1;
            Pot._event.once(taskId, func);
        }
    },
    //插入等待异步返回消息的对象
    store: function(uuid, action, data){
        if (uuid in Pot._actionContainer){
            //logger.error('another action of '+type+' '+uuid+' is running '
            //  +JSON.stringify(Pot._actionContainer[uuid]));
        } else {
            Pot._actionContainer[uuid] = {
            }
            Pot._actionContainer[uuid][action] = data;
        }
    },
    //action当前可为任意值
    get: function(uuid, action){
        if (uuid in Pot._actionContainer){
            return Pot._actionContainer[uuid];
        } else {
            return false;
        }
    },
    remove: function(lcuuid, action){
        delete Pot._actionContainer[lcuuid];
    },
    //异步返回消息队列
    queue: {
        add: function(info){
            logger.info(Pot._taskContainer, info);
            var type = info.TYPE, data = info.DATA;
            if (info.TASK in Pot._taskContainer){
                Pot._event.emit(info.TASK, info);
                //会自动清除task记录
                delete(Pot._taskContainer[info.TASK]);
            } else {
                //需要手动去remove 对象记录
                logger.info('queue add', data, Pot._actionContainer);
                if (data.LCUUID in Pot._actionContainer){
                    //only one action is allowed
                    for (var action in Pot._actionContainer[data.LCUUID]){
                        Pot._event.emit(type + data.LCUUID + action, info);
                        return;
                    }
                } else {
                    data.TYPE = type;
                    if (data.LCUUID in Pot._enforceSyncContainer){
                        lc_utils.replaceObject(Pot._enforceSyncContainer[data.LCUUID], data);
                    } else {
                        Pot._enforceSyncQueue.push(data);
                        Pot._enforceSyncContainer[data.LCUUID] = data;
                    }
                }
            }
            Pot.queue.run();
        },
        run: function(){
            if (!Pot.queue._runFlag) {
                if (Pot._enforceSyncQueue.length){
                    var data = Pot._enforceSyncQueue.shift();
                    delete(Pot._enforceSyncContainer[data.LCUUID]);
                    var type = data.TYPE;
                    delete(data.TYPE);
                    Pot.trigger(type, 'enforSync', data)
                    Pot.queue.run();
                } else {
                    Pot.queue._runFlag = false;
                }
            }
        },
        _runFlag: false,
    },
    event_parser: function(){
        return{
            map: function(data){
                console.log('async response', data);
                if (data.TYPE == 'BlockDevice'){
                    data.TYPE = 'BLOCK_DEVICE';
                }
                if (data.TYPE == 'BLOCK_SNAPSHOT'){
                    data.TYPE = 'BLOCK_DEVICE';
                }
                if ('TYPE' in data && 'LCUUID' in data.DATA
                && ['BLOCK_DEVICE', 'VM_SNAPSHOT', 'VM_BLOCK'].indexOf(data.TYPE) != -1){
                    Pot.queue.add(data);
                } else if (data.TASK){
                    Pot.queue.add(data);
                }
            }
        }
    }
}


module.exports = Pot;
