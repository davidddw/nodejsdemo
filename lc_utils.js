var logger = require('./logger.js');
var constr = require('./const.js');
var api = require('./api.js');
var flow = require('./flow.js');

// add bulit-in obj method
var bget = function(a, key){
    if (key in a){
        return a[key];
    } else{
        return '';
    }
}

var drainJsonKey = function (json, func) {
    if (!json) {
        return json;
    } else if (json instanceof Array) {
        var new_json = [];
        for (var i = 0; i < json.length; ++i) {
            new_json[i] = drainJsonKey(json[i], func);
        }
    } else if (typeof(json) == 'object') {
        var new_json = {}
        for (var key in json) {
            new_json[func(key)] = drainJsonKey(json[key], func);
        }
    } else {
        return json;
    }
    return new_json;
}

function delBget(json) {
    if (json && json.constructor == Array){
        json.forEach(function(i){
            delBget(i);
        })
    } else if (json && typeof(json) == 'object'){
        for (var i in json){
            delBget(json[i]);
        }
    } else{
        return;
    }
}

function upperJsonKey(json) {
    return drainJsonKey(json, function (key) {return key.toUpperCase()});
}

function lowerJsonKey(json) {
    return drainJsonKey(json, function (key) {return key.toLowerCase()});
}

var checkBWRequest = function(data, errorcallback) {
    var req = ['userid', 'isp', 'bandw', 'vifid'];
    var i;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: req[i]+' not specified'});
            return false;
        }
    }
    return true;
}

var checkBWRequest_v2 = function(data, errorcallback) {
    var req = ['userid', 'isp', 'bandw', 'type', 'lcuuid'];
    var i;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: req[i]+' not specified'});
            return false;
        }
    }
    return true;
}

var checkNETConfig = function(data, errorcallback) {
    var req = ['lcuuid', 'type'];
    var i;
    for (i = 0; i < req.length; i++){
        if (!(req[i] in data)){
            errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: req[i]+' not specified'});
            return false;
        }
    }
    if (data.type != 'vm' && data.type != 'vgateway' && data.type != 'hwdev') {
        errorcallback(400, {OPT_STATUS: constr.OPT.INVALID_POST_DATA, DESCRIPTION: 'invalid type'});
        return false;
    }
    return true;
}
/*
 * data={'userid':xx, 'isp':xx, 'bandw':xx, 'vifid':xx}
 */
function checkbandwidth(data, errorcallback, app, p) {
    var bandw = 0;
    var condition = 'select * from ?? where ??=? and ??=?';
    var con = 'select * from ?? where id in (-1';
    var i;

    if (!checkBWRequest(data, errorcallback)) {
        return;
    }

    app.list.push(function(a, f){
        p.executeSql(condition)(
            [p.bwtableName, 'isp', data.isp, 'userid', data.userid],
            function(ans){
                for (i = 0; i < ans.length; i++) {
                    bw_total += ans[i].bandwidth;
                }
                if (bw_total) {
                    f(a);
                } else {
                    errorcallback(500, {'OPT_STATUS': constr.OPT.NOT_ENOUGH_BANDWIDTH, 'DESCRIPTION': 'Please buy the bandwidth first'});
                    app.STD_END()
                }
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });

    app.list.push(function(a, f){
        p.executeSql(condition)(
            [p.iptableName, 'userid', data.userid, 'isp', data.isp],
            function(ans){
                for (i = 0; i < ans.length; i++) {
                    if (ans[i].vifid && ans[i].vifid != data.vifid) {
                        con = con + ',' + ans[i].vifid;
                    }
                }
                con += ')';
                f(a);
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });

    app.list.push(function(a, f){
        p.executeSql(con)(
            [p.viftableName],
            function(ans){
                for (i = 0; i < ans.length; i++) {
                    bandw += ans[i].bandw;
                }
                if (data.bandw > (bw_total - bandw)) {
                    errorcallback(400, {'OPT_STATUS': constr.OPT.NOT_ENOUGH_BANDWIDTH, 'DESCRIPTION': 'invalid bandwidth'});
                    app.STD_END()
                } else {
                    f(a);
                }
            },
            function(a){errorcallback(a), app.STD_END()}
        );
    });
}

/*
 * data={'userid':xx, 'isp':xx, 'bandw':xx, 'type':xx, 'lcuuid':xx}
 * type is "VM" OR "VGATEWAY" OR "THIRDHW"
 */
function checkbandwidth_v2(data, errorcallback, app, p) {
    var condition = 'select * from ?? where ??=? and ??=?';
    var bw_total = 0;
    var i;

    if (!checkBWRequest_v2(data, errorcallback)) {
        return;
    }

    app.list.push(function(a, f){
        var url = '/v1/bandwidths';
        p.sendData(url, 'get',
            {
                'userid': data.userid,
                'isp': data.isp,
                'exclude-device-type':data.type,
                'exclude-device-lcuuid':data.lcuuid
            },
            function(sCode, rdata){
                if (rdata.DATA.length == 1) {
                    data.user_bandwidth = rdata.DATA[0];
                } else {
                    data.user_bandwidth = {
                        'ISP': data.isp,
                        'BANDWIDTH': 0,
                        'USED_BANDWIDTH': 0,
                    }
                }
                f(a);
            },
            function(code, resp){
                errorcallback(code, resp);
                app.STD_END();
            }
        );
    });

    app.list.push(function(a, f){
        if (data.bandw > (data.user_bandwidth.BANDWIDTH - data.user_bandwidth.USED_BANDWIDTH)) {
            errorcallback(400, {
                'OPT_STATUS': constr.OPT.NOT_ENOUGH_BANDWIDTH,
                'DESCRIPTION': data.user_bandwidth.USED_BANDWIDTH
                             + '/' + data.user_bandwidth.BANDWIDTH
                             + ' bandwidth are used but device '
                             + data.type + ' ' + data.lcuuid
                             + ' need ' + data.bandw,
            });
            app.STD_END();
        } else {
            logger.info('check bandwidth pass');
            f(a);
        }
    });
}

function checkBandwidth_v3(data, errorcallback, app, p) {
    var condition = 'select * from ?? where ??=? and ??=?';
    var bw_total = 0;
    var i;

    var Q = new flow.Qpack(flow.serial);

    Q.then(function(){
        checkBWRequest_v2(data, function(code, body){
            Q.reject(code, body);
        })
    })
    .then(api.scallTalker(
        'GET',
        'v1/bandwidths',
        {
            isp: data.isp,
            userid: data.userid,
            'exclude-device-type': data.type,
            'exclude-device-lcuuid': data.lcuuid,
        }
    ))
    .then(function(rdata){
        if (rdata.length == 1) {
            data.user_bandwidth = rdata[0];
        } else {
            data.user_bandwidth = {
                'ISP': data.isp,
                'BANDWIDTH': 0,
                'USED_BANDWIDTH': 0,
            }
        }
        if (data.bandw > (data.user_bandwidth.BANDWIDTH - data.user_bandwidth.USED_BANDWIDTH)) {
            Q.reject(400, {
                'OPT_STATUS': constr.OPT.NOT_ENOUGH_BANDWIDTH,
                'DESCRIPTION': data.user_bandwidth.USED_BANDWIDTH
                             + '/' + data.user_bandwidth.BANDWIDTH
                             + ' bandwidth are used but device '
                             + data.type + ' ' + data.lcuuid
                             + ' need ' + data.bandw,
            });
        }
    })
    return Q;
}

function checkInstanceNum(data) {
    if(!('num' in data && 'type' in data)){
        return false;
    }
    if (data.num > 1024) {
        var opt_status,description;
        if(data.type == 'IPS'){
            opt_status = constr.OPT.IP_MAX_NUM_EXCEEDED;
            description = constr.OPT_CH.IP_MAX_NUM_EXCEEDED;
        }else if(data.type == 'BANDWIDTHS'){
            opt_status = constr.OPT.BW_MAX_NUM_EXCEEDED;
            description = constr.OPT_CH.BW_MAX_NUM_EXCEEDED;
        }else if(data.type == 'VGWS'){
            opt_status = constr.OPT.VGW_MAX_NUM_EXCEEDED;
            description = constr.OPT_CH.VGW_MAX_NUM_EXCEEDED;
        }else if(data.type == 'VMS'){
            opt_status = constr.OPT.VM_MAX_NUM_EXCEEDED;
            description = constr.OPT_CH.VM_MAX_NUM_EXCEEDED;
        }else if(data.type == 'LBS'){
            opt_status = constr.OPT.LB_MAX_NUM_EXCEEDED;
            description = constr.OPT_CH.LB_MAX_NUM_EXCEEDED;
        }else if(data.typeof == 'VFWS') {
            opt_status = constr.OPT.VFW_MAX_NUM_EXCEEDED;
            description = constr.OPT_CH.VFW_MAX_NUM_EXCEEDED;
        }
        logger.info('check Instance Num',opt_status,description);
        return false;
    }
    return true;
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

//return everything b apart from a
function diffObject(a, b){
    var diff = {};
    for (var i in b){
        if (!(i in a) || a[i] != b[i]){
            diff[i] = b[i];
        }
    }
    return diff;
}

//set a to b's values without change its pointer
function replaceObject(a, b){
    for (var i in b){
        a[i] = b[i];
    }
    for (var j in a){
        if (!(j in b)){
            delete(a[j])
        }
    }
}

//a中所有的值更新为b中相同键的值
function updateObject(a, b){
    for (var i in a){
        if (i in b){
            a[i] = b[i];
        }
    }
}

function mergeObject(a, b){
    var res = {};
    for (var i in a){
        res[i] = a[i];
    }
    for (i in b){
        res[i] = b[i];
    }
    return res;
}

module.exports = {
    bget: bget,
    upperJsonKey: upperJsonKey,
    lowerJsonKey: lowerJsonKey,
    checkbandwidth: checkbandwidth,
    checkbandwidth_v2: checkbandwidth_v2,
    checkBandwidth_v3: checkBandwidth_v3,
    delBget : delBget,
    checkInstanceNum : checkInstanceNum,
    Map: Map,
    replaceObject: replaceObject,
    updateObject: updateObject,
    mergeObject: mergeObject
};

/* TEST */

/*
var a = JSON.parse('{"data": [ { "wan": { "ips": [ { "ip_resource_lcuuid": "ce1d5716-caab-44f4-b7bb-05bde32819b6" } ], "qos": { "max_bandwidth": 2097152, "min_bandwidth": 2097152 } }, "state": 1, "if_index": 1, "if_type": "WAN" }, { "wan": { "ips": [ { "ip_resource_lcuuid": "2607fe90-0e2d-416e-b11f-9d26a795ec94" } ], "qos": { "max_bandwidth": 2097152, "min_bandwidth": 2097152 } }, "state": 1, "if_index": 2, "if_type": "WAN" }, { "wan": { "ips": [ { "ip_resource_lcuuid": "e839dfea-1c3d-4c92-ad97-f85ae76bf82d" } ], "qos": { "max_bandwidth": 2097152, "min_bandwidth": 2097152 } }, "state": 1, "if_index": 3, "if_type": "WAN" }, { "state": 1, "if_index": 10, "lan": { "ips": [ { "vl2_net_index": 1, "address": "10.40.41.1" } ], "vl2_lcuuid": "1537ab84-d62e-41ea-bb25-2783ec2ab766", "qos": { "max_bandwidth": 0, "min_bandwidth": 0 } }, "if_type": "LAN" }, { "state": 1, "if_index": 11, "lan": { "ips": [ { "vl2_net_index": 1, "address": "10.40.42.1" } ], "vl2_lcuuid": "ec613a2a-ebe9-4d64-b611-9b356f207182", "qos": { "max_bandwidth": 0, "min_bandwidth": 0 } }, "if_type": "LAN" }, { "state": 1, "if_index": 12, "lan": { "ips": [ { "vl2_net_index": 1, "address": "10.40.43.1" } ], "vl2_lcuuid": "67741734-83cd-4b49-98c2-de3e86d1e25c", "qos": { "max_bandwidth": 0, "min_bandwidth": 0 } }, "if_type": "LAN" } ] }');
console.log(JSON.stringify(upperJsonKey(a)));
var a = JSON.parse('[{"if_index":1,"state":1,"if_type":"wan","wan":{"ips":[{"ip_resource_lcuuid":"87b69a21-af8f-4d0f-87dd-cbf5ffd4e5ce"}],"qos":{"min_bandwidth":512,"max_bandwidth":512}}},{"if_index":2,"state":1,"if_type":"wan","wan":{"ips":[{"ip_resource_lcuuid":"87b69a21-af8f-4d0f-87dd-cbf5ffd4e5cf"}],"qos":{"min_bandwidth":512,"max_bandwidth":512}}}]');
var a = JSON.parse('{"a":1, "Bc": [1,2,3, null], "D": { "d": 5, "e": [6,7], "f": null, "g": "hello"}}');
var b = JSON.parse('[1,2,3,"A",{"c": 4},null]');
console.log(upperJsonKey(a));
console.log(lowerJsonKey(upperJsonKey(a)));
console.log(upperJsonKey(b));
console.log(lowerJsonKey(upperJsonKey(b)));
var c = upperJsonKey(a);
delBget(c);
console.log(c);
*/
