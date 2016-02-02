var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var flow = require('./flow.js');
var Vdc = require('./vdc.js');
var Vpc = require('./vpc.js');
var Epc = require('./epc.js');
var operationLog = require('./operation_log.js');
var lc_utils = require('./lc_utils.js');
var constr = require('./const.js');

//special


var Vl2 = function(){
    Obj.call(this);
    this.tableCols = [
        'id',
        'name',
        'state',
        'description',
        'vcloudid',
        'vnetid',
        'ip',
        'netmask',
        'vlantag',
        'lcuuid',
        'operationid',
        'epc_id',
        'userid',
        'domain',
    ];
};
util.inherits(Vl2, Obj);
Vl2.prototype.state = {
        TEMP : 0,
        CREATING : 1,
        CREATED : 2,
        EXCEPTION : 3,
        MODIFYING : 4,
        DELETING : 5,
        DELETED : 6
};
Vl2.prototype.tableName = 'fdb_vl2_v2_2';
Vl2.prototype.type = 'vl2';
Vl2.prototype.required = ['vlantag', 'epc_id', 'userid', 'nets'];
Vl2.prototype.netrequired = ['prefix', 'netmask'];
Vl2.prototype.updaterequired = ['nets'];
Vl2.prototype.bdbCols = ['name', 'vlantag', 'epc_id', 'userid'];
Vl2.prototype.getResponse = ['name', 'state', 'vlantag', 'lcuuid', 'epc_id', 'userid'];
Vl2.prototype.constructor = Vl2;

Vl2.prototype.getActionStatus = function(cur){
    if (this.action == 'create'){
        if (cur.state != this.state.TEMP){
            return 'done';
        } else{
            return 'failed';
        }
    }
    else if (this.action == 'delete'){
        if (cur.state == this.state.DELETED){
            return 'done';
        } else{
            return 'failed';
        }
    } else if (this.action == 'modify'){
        return 'done';
    } else{
        return 'dontknow';
    }
}
Vl2.prototype.checkRequest = function(data, errorcallback){
    switch(this.action) {
        case 'create':
            var req = this.required;
            break;
        case 'modify':
            if ('nets' in data) {
                var req = this.updaterequired;
            } else {
                var req = ['epc_id'];
            }
            break;
        default:
            return false;
    }
    var netreq = this.netrequired;
    var i, j;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: netreq[i]+' not specified'});
            return false;
        }
    }
    if ('vlantag' in data && typeof(data['vlantag']) != 'number'){
        errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: 'vlantag must be digital'});
        return false;
    }
    if ('nets' in data) {
        for (i = 0; i < netreq.length; i++){
            for (j = 0; j < data['nets'].length; j++) {
                if (!(netreq[i] in data['nets'][j])){
                    errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: netreq[i]+' not specified for nets'});
                    return false;
                }
                if (netreq[i] == 'netmask') {
                    if (typeof(data['nets'][j]['netmask']) != 'number'){
                        errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: netreq[i]+' must be digital'});
                        return false;
                    } else if (data['nets'][j]['netmask'] > 32) {
                        errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: netreq[i]+' must be less than 32'});
                        return false;
                    }
                }
            }
        }
    }
    return true;
}
Vl2.prototype.parseDBToResponse = function(data){
    var i, key='';
    var cols = this.getResponse;
    var tmp = {};
    for (j=0; j<cols.length; j++){
        key = cols[j].toUpperCase();
        tmp[key] = data[cols[j]];
    }
    return tmp;
}
Vl2.prototype.parseApiToBdbData = function(data, callback){
    var ans = {};
    var req = this.bdbCols;
    var netreq = this.netrequired;
    var i, j, key='';
    for (i = 0; i < req.length; i++){
        key = req[i].toUpperCase();
        if (req[i] in data) {
            ans[key] = data[req[i]];
        }
    }
    if ('nets' in data) {
        ans['NETS'] = [];
        for (i = 0; i < data['nets'].length; i++){
            tmp = {};
            for (j = 0; j < netreq.length; j++) {
                key = netreq[j].toUpperCase();
                if (netreq[j] in data['nets'][i]) {
                    tmp[key] = data['nets'][i][netreq[j]];
                }
            }
            ans['NETS'].push(tmp);
        }
    }
    var params = [];
    new flow.parallel(params).fire('', function(){callback(ans)});

}
Vl2.prototype.parseApiToFdbData = function(data){
    var ans = {};
    var cols = this.tableCols, key='';
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[cols[i]] = data[key];
        } else if(cols[i] in data){
            ans[cols[i]] = data[cols[i]]
        }
    }
    return ans;
}
Vl2.prototype.parseBdbToFdb = function(data){
    var cols = this.tableCols, key='';
    var ans = {};
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[cols[i]] = data[key];
        } else if(cols[i] in data){
            ans[cols[i]] = data[cols[i]];
        }
    }
    //ans['id'] = data.LCID;
    return ans;
}
Vl2.prototype.parseBdbToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = {DATA:'', OPT_STATUS:data.OPT_STATUS, TYPE:data.TYPE};
    result.DATA = this.parseBdbToFdb(data.DATA);
    return result;
}

Vl2.prototype.formBdbApiData = function(data){
    return data;
}

Vl2.prototype.getVdcVl2s = function(id, callback){
    this.selectSql([this.tableName, 'vnetid', id], callback, logger.info);
}
Vl2.prototype.writeToSql = function(callback, errorcallback, deleteflag){
    var p = this;
    for(var i in p.data_diff){
        logger.debug('writing to sql ... ',i, p.data_diff, p.data);
        var params = [];
        var pre_data = '';
        params.push(
            function(a, f){
                if ('lcuuid' in p.data){
                    var t = [p.tableName, 'lcuuid', p.data.lcuuid];
                } else if ('id' in p.data){
                    var t = [p.tableName, 'id', p.data.id];
                } else{
                    throw new Error('id or lcuuid not found in data_diff/data');
                }
                p.selectSql(
                    t,
                    function(ans){
                        if (ans.length > 0){
                            pre_data = ans[0];
                            p.data_diff.id = pre_data.id;
                        }
                        //even if not found, id will be set in data
                        f(a);
                    },
                    function(e){logger.info(e); f(a)}
                )
            }
        );
        if (deleteflag != true){
            params.push(
                function(a, f){
                logger.info('p.data_diff is ', p.data_diff);
                    p.updateSql(
                        [p.tableName, p.data_diff, 'id', p.data.id],
                        function(){logger.debug('data_diff stored to sql'); f(a); },
                        logger.info
                    );
                }
            );
        } else{
            params.push(
                function(a, f){
                    p.deleteSql(
                        [p.tableName, 'id', p.data.id],
                        function(){logger.debug('vl2 deleted from sql'); f(a); },
                        logger.info
                    );
                }
            );
        }
        new flow.serial(params).fire('', function(a){
            var action_status = p.getActionStatus(p.data_diff);
            var msg = {type:'user', target:pre_data.epc_id, msg:{action:p.action, state:action_status, type:'vl2', id:pre_data.lcuuid}};
            msg.msg.id = pre_data.id;
            p.sendToMsgCenter(msg);
            callback();
        })
        return;
    }
    logger.debug('data_diff is null, ignore writing to sql');
}

/********operations*********/
Vl2.prototype.create = function(data, callback, errorcallback){
    var p = this;
    p.action = 'create';
    var res = p.checkRequest(data, errorcallback);
    if (!res){
        return;
    }
    var operator_name = data.operator_name;
    var fdbdata = p.parseApiToFdbData(data);
    fdbdata.state = p.state.TEMP;
    if('domain' in fdbdata){
        delete fdbdata['domain'];
    }
    var bdbdata = lc_utils.upperJsonKey(data);
    lc_utils.delBget(bdbdata);
    p.insertSql(
        [p.tableName, fdbdata],
        function(ans){
            operationLog.create({operation:'create', objecttype:'vl2', objectid:ans.insertId,
                object_userid:data.userid, operator_name:operator_name});
            p.sendData('/v1/subnets', 'post', bdbdata, function(sCode, data){
                var res_data = p.parseBdbToFdbData(data);
                var newdata = res_data.DATA;
                data.DATA.ID = ans.insertId;
                newdata.state = p.state.CREATING;
                p.data.LCUUID = data.DATA.LCUUID;
                p.updateSql(
                    [p.tableName, newdata, 'id', ans.insertId],
                    logger.info,
                    logger.info
                );
                callback(data)
            }, function(a, b){
                operationLog.update({objecttype:'vl2', objectid:ans.insertId,
                    opt_result:2, error_code:'SERVICE_EXCEPTION'});
                p.deleteSql(
                    [p.tableName, 'id', ans.insertId],
                    function(){
                        errorcallback(a, b)
                    },
                    errorcallback
                );
            });
        },
        errorcallback
    );
}
Vl2.prototype.update = function(data, callback, errorcallback){
    var p = this;
    p.action = 'modify';
    var res = p.checkRequest(data, errorcallback);
    if (!res){
        return;
    }
    if ('epc_id' in data) {
        p.updateSql(
            [p.tableName, {'epc_id':data.epc_id}, 'id', data.id],
            function(){
                callback({"OPT_STATUS":"SUCCESS"})
            },
            errorcallback
        );
    } else {
        var operator_name = data.operator_name;
        vl2id = data.id
        var next = function(bdbdata){
            p.selectSql(
                [p.tableName, 'id', data.id],
                function(ans){
                    if (ans.length > 0){
                        data.lcuuid = ans[0].lcuuid;
                        p.data.lcuuid = data.lcuuid;
                        operationLog.create({operation:'update', objecttype:'vl2', objectid:data.id,
                            object_userid:ans[0].userid, operator_name:data.operator_name});//note: userid
                        p.sendData('/v1/subnets/'+data.lcuuid, 'patch', bdbdata, function(sCode, data){
                            var res_data = p.parseBdbToFdbData(data);
                            var newdata = res_data.DATA;
                            data.DATA.ID = vl2id;
                            callback(data);
                        }, function(a, b){
                            operationLog.update({objecttype:'vl2', objectid:vl2id,
                                opt_result:2, error_code:'SERVICE_EXCEPTION'});
                            errorcallback(a, b)
                        });
                    }
                },
                errorcallback
            );
        }
        p.parseApiToBdbData(data, next);
    }
}
Vl2.prototype.del = function(data, callback, errorcallback){
    var p = this;
    p.action = 'delete';
    var fdbdata = p.parseApiToFdbData(data);
    if ('lcuuid' in fdbdata){
        delete(fdbdata.lcuuid);
    }
    var next = function(){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(ans){
                if (ans.length > 0){
                    data.lcuuid = ans[0].lcuuid;
                    p.data.lcuuid = data.lcuuid;
                    //special
                    operationLog.create({operation:'delete', objecttype:'vl2', objectid:data.id,
                        object_userid:ans[0].userid, operator_name:data.operator_name});//note: userid
                    p.sendData('/v1/subnets/'+data.lcuuid, 'delete', {}, function(sCode, rdata){
                        operationLog.update({objecttype: 'vl2', objectid: data.id, opt_result:1},
                            function(){
                                p.deleteSql(
                                    [p.tableName, 'lcuuid', data.lcuuid],
                                    function(ans){
                                    },
                                    errorcallback
                                )
                            }
                        );
                        callback(rdata);
                        },
                        function(a,b){
                            operationLog.update({objecttype:'vl2', objectid:data.id,
                                opt_result:2, error_code:'SERVICE_EXCEPTION'});
                            errorcallback(a, b);
                        }
                    );
                } else{
                    operationLog.update({objecttype:'vl2', objectid:data.id, opt_result:2, error_code:'SERVICE_EXCEPTION'});
                    errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: 'not found'});
                }
            },
            errorcallback
        );
    }
    p.parseApiToBdbData(data, next);
}
Vl2.prototype.get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var condition = 'select * from ?? where true';
    var param = [p.tableName];
    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    if ('id' in data) {
        condition += ' and ??=?';
        if (data.id > 0) {
            param.push('id');
            param.push(data.id);
            flow_steps.push(function(a, f){
                p.selectSql(
                    [p.tableName, 'id', data.id],
                    function(ans){
                        if (ans.length > 0) {
                            data.lcuuid = ans[0].lcuuid;
                            f(a);
                        } else {
                            errorcallback(404, {OPT_STATUS: constr.OPT.RESOURCE_NOT_FOUND, DESCRIPTION: 'not found'});
                            app.STD_END();
                        }
                    },
                    function(a){errorcallback(a), app.STD_END()}
                );
            });
        } else {
            data.lcuuid = data.id;
            param.push('lcuuid');
            param.push(data.lcuuid);
        }
    }

    if ('userid' in data) {
        condition += ' and ??=?';
        param.push('userid');
        param.push(data.userid);
    }

    flow_steps.push(function(a, f){
        var filter = {};
        var lcuuid = '';
        if ('userid' in data) {
            filter.userid = data.userid;
        }
        if ('epc_id' in data) {
            filter.epc_id = data.epc_id;
        }
        if ('lcuuid' in data) {
            condition += ' and ??=?';
            param.push('lcuuid');
            param.push(data.lcuuid);
            lcuuid = '/' + data.lcuuid
        }
        if ('domain' in data) {
            filter.domain = data.domain;
        }
        p.executeSql(condition)(
            param,
            function(ans){
                p.sendData('/v1/subnets'+lcuuid, 'get', filter, function(sCode, rdata){
                    var i, j, flag;
                    if (rdata.OPT_STATUS == 'SUCCESS') {
                        if (rdata.DATA instanceof Array) {
                            for (i = rdata.DATA.length - 1; i >= 0 ; --i) {
                                flag = 0;
                                for (j = 0; j < ans.length; j++) {
                                    if (rdata.DATA[i].LCUUID == ans[j].lcuuid) {
                                        flag = 1;
                                        rdata.DATA[i].ID = ans[j].id;
                                        rdata.DATA[i].STATE = ans[j].state;
                                        break;
                                    }
                                }
                                if (flag == 0) {
                                    rdata.DATA.splice(i, 1);
                                }
                            }
                        } else {
                            rdata.DATA.ID = ans[0].id;
                            rdata.DATA.STATE = ans[0].state;
                        }
                    }
                    callback(rdata)
                },
                function(sCode, rdata){
                    errorcallback(sCode, rdata)
                }
                );
                f(a);
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });

    app.fire('', function(){});
}
Vl2.prototype.default_event_parser = function(data, callback, errorcallback){
    var p = this;
    if (data.state == p.state.DELETED){
        p.deleteSql([this.tableName, 'lcuuid', data.lcuuid],
                    function(ans) {
                        callback(ans);
                    },
                    function() {
                        p.writeToSql(callback, errorcallback, true);
                    })

    } else{
        p.writeToSql(callback, errorcallback);
    }
}


module.exports=Vl2;
