var logger = require('./logger.js');
var constr = require('./const.js');
var util = require('util');
var Obj = require('./obj.js');
var flow = require('./flow.js');
var lc_utils = require('./lc_utils.js');
var dataFormat = require('./data.js');
var api = require('./api.js');
var instancePot = require('./instancePot.js');
var api = require('./api.js');
var constr = require('./const.js');
var uuid = require('node-uuid');


var Task = function(){
}

Task.prototype.asyncTask = function(method, url, data, syncCallback, asyncCallback){
    syncCallback = syncCallback ? syncCallback : function(){};
    asyncCallback = asyncCallback ? asyncCallback : function(){};
    var requestid = uuid.v4();
    var Q = new flow.Qpack(flow.serial);
    Q._type = 'API';
    Q._fileds = {
        'method': method,
        'url': url,
        'data': data,
    }
    Q._isAtom = true;
    Q._requestId = requestid;
    logger.info('call  '+requestid, method.toUpperCase(),
        'appserver', 'with ', data, '');
    Q.then(api.callTalker(method, url, data))
    .then(function(ans, onFullfilled){
        logger.info('api '+requestid+' res status code', ans.code, '>', JSON.stringify(ans.body));
        if (ans.code != 200){
            Q.reject(ans.code, ans.body);
            onFullfilled();
        } else {
            ans = ans.body;
            syncCallback(ans);
            if (ans.WAIT_CALLBACK == true){
                if (!ans.TASK){
                    throw new Error('task return should has a taskID')
                }
                instancePot.storeTask(ans.TASK, function(asyncData){
                    logger.info('api '+requestid+' async status code', 200, '>', JSON.stringify(asyncData));
                    asyncCallback(asyncData);
                    if (asyncData.OPT_STATUS != constr.OPT.SUCCESS){
                        Q.reject(asyncData);
                    }
                    onFullfilled(asyncData.DATA);
                })
            } else {
                onFullfilled(ans.DATA);
            }
        }
    })
    return Q;
}




module.exports = Task;
