var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var flow = require('./flow.js');
var Vdc = require('./vdc.js');
var Vl2 = require('./vl2.js');
var Vpc = require('./vpc.js');
var lc_utils = require('./lc_utils.js');

var Vgw = function(){
    Obj.call(this);
    this.tableCols =[
        'id',
        'vdcid',
        'state',
        'flag',
        'errno',
        'description',
        'poolid',
        'userid',
        'gw_launch_server',
        'haflag',
        'hastate',
        'haswitchmode',
        'create_time',
        'name',
        'lcuuid',
    ];
};
util.inherits(Vgw, Obj);
Vgw.prototype.state = {
    TEMP : 0,
    CREATING : 1,
    CREATED : 2,
    ERROR : 3,
    MODIFYING : 4,
    DELETING : 5,
    STARTING : 6,
    RUNNING : 7,
    STOPPING : 8,
    STOP : 9,
    DELETED : 10,
};
Vgw.prototype.getActionStatus = function(cur){
    if (this.action == 'create'){
        if (cur.state != this.state.TEMP){
            return 'done';
        } else{
            return 'failed';
        }
    } else if (this.action == 'start'){
        if (cur.state == this.state.RUNNING){
            return 'done';
        } else{
            return 'failed';
        }
    } else if (this.action == 'stop'){
        if (cur.state == this.state.STOP){
            return 'done';
        } else{
            return 'failed';
        }
    } else{
        return 'dontknow';
    }

}
Vgw.prototype.tableName = 'fdb_vgw_v2_2';
Vgw.prototype.type = 'vgw';
Vgw.prototype.constructor = Vgw;

Vgw.prototype.parseFdbToBdbData = function(data){
    var ans = {};
    var cols = this.tableCols, key='';
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[key] = data[key];
        } else if (cols[i] in data){
            ans[key] = data[cols[i]]
        }
    }
    if ('ID' in ans){
        ans['LCID'] = ans.ID;
    } else if ('id' in ans){
        ans['LCID'] = ans.id;
    }
    return ans;
}
Vgw.prototype.parseApiToBdbData = function(data, callback){
    var ans = {};
    if (typeof data != 'object')
        throw new Error('api data must be an object');
    ans['NAME'] = lc_utils.bget(data, 'name');
    ans['VDCID'] = lc_utils.bget(data, 'vdcid');
    ans['VCLOUDID'] = lc_utils.bget(data, 'vcloudid');
    ans['GW_POOLID'] = lc_utils.bget(data, 'gw_poolid');
    ans['GW_LAUNCH_SERVER'] = lc_utils.bget(data, 'gw_launch_server');
    if ('if1' in data){
        ans['IF1'] ={ISP:data.if1.isp, IP_NUM:data.if1.ip_num, IPS:data.if1.ips, BW:lc_utils.bget(data.if1, 'bw')};
    }
    if ('if2' in data){
        ans['IF2'] ={ISP:data.if2.isp, IP_NUM:data.if2.ip_num, IPS:data.if2.ips, BW:lc_utils.bget(data.if2, 'bw')};
    }
    if ('if3' in data){
        ans['IF3'] ={ISP:data.if3.isp, IP_NUM:data.if3.ip_num, IPS:data.if3.ips, BW:lc_utils.bget(data.if3, 'bw')};
    }

    ans['HAFLAG'] = lc_utils.bget(data, 'haflag');
    ans['HASTATE'] = lc_utils.bget(data, 'hastate');
    ans['HASWITCHMODE'] = lc_utils.bget(data, 'haswitchmode');
    ans['USERID'] = lc_utils.bget(data, 'userid');
    if ('state' in data){
        if (data.state == this.state.STARTING){
            ans.STATE = this.state.RUNNING;
        } else if (data.state == this.state.STOPPING){
            ans.STATE = this.state.STOP;
        }
    }
    if ('alloc_type' in data && data.alloc_type.toLowerCase() == 'auto'){
        delete(ans.GW_POOLID);
        delete(ans.GW_LAUNCH_SERVER);
    }
    for (var i in ans){
        if (ans[i] === ''){
            delete(ans[i]);
        }
    }


    var p = this;
    new flow.parallel([
        function(a, f){
            if ('GW_POOLID' in ans && ans.GW_POOLID){
                p.selectSql(
                    ['pool_v2_2', 'id', ans.GW_POOLID],
                    function(data){
                        if (data.length > 0){
                            ans['GW_POOL_LCUUID'] = data[0].lcuuid;
                            delete(ans['GW_POOLID']);
                        } else{
                            logger.info('pool id '+ans.GW_POOLID+' not found');
                        }
                        f(a);
                    }
                )
            } else{
                f(a);
            }
        },
        function(a, f){
            if ('vdcid' in data){
                var vl2 = new Vl2();
                vl2.getVdcVl2s(data.vdcid, function(vl2sdata){
                    for (var i=0; i<vl2sdata.length; i++){
                        ans['SUBNET'+(i+1)+'_LCUUID'] = vl2sdata[i].lcuuid;
                    }
                    f(a);
                })
            } else{
                f(a);
            }
        },
        function(a, f){
            if ('vdcid' in data){
                p.selectSql(
                    [Vdc.prototype.tableName, 'id', ans['VDCID']],
                    function(data){
                        if (data.length > 0){
                            ans['VDC_LCUUID'] = data[0].lcuuid;
                            delete(ans['VDCID']);
                        } else{
                            logger.info('vdc of '+ans.VDCID+' not found');
                        }
                        f(a);
                    },
                    function(){
                        logger.info('vdc of '+ans.VDCID+' not found');
                        f(a);
                    }
                )
            } else{
                f(a);
            }
        },
        function(a, f){
            if ('vcloudid' in data){
                p.selectSql(
                    [Vpc.prototype.tableName, 'id', ans['VCLOUDID']],
                    function(data){
                        if (data.length > 0){
                            ans['VCLOUD_LCUUID'] = data[0].lcuuid;
                            delete(ans['VCLOUDID']);
                        } else{
                            logger.info('vdc of '+ans.VCLOUDID+' not found');
                        }
                        f(a);
                    },
                    function(){
                        logger.info('vdc of '+ans.VCLOUDID+' not found');
                        f(a);
                    }
                )
            } else{
                f(a)
            }
        }
    ]).fire('', function(){
        var res = {};
        res.DATA = [ans];
        if ('alloc_type' in data){
            res['ALLOCATION_TYPE'] = data.alloc_type.toUpperCase();
        }
        if ('type' in data){
            res['TYPE'] = data.type.toUpperCase();
        }
        callback(res);
    })


}
Vgw.prototype.parseModifyApiToBdbData = function(data){
    var ans = {};
    ans['NAME'] = lc_utils.bget(data, 'name');
    ans['LCUUID'] = lc_utils.bget(data, 'lcuuid');
    ans['LCID'] = lc_utils.bget(data, 'id');
    if ('if1' in data){
        ans['IF1'] ={ISP:data.if1.isp, IP_NUM:data.if1.ip_num, IPS:data.if1.ips, BW:data.if1.bw};
    }
    if ('if2' in data){
        ans['IF2'] ={ISP:data.if2.isp, IP_NUM:data.if2.ip_num, IPS:data.if2.ips, BW:data.if2.bw};
    }
    if ('if3' in data){
        ans['IF3'] ={ISP:data.if3.isp, IP_NUM:data.if3.ip_num, IPS:data.if3.ips, BW:data.if3.bw};
    }
    if ('state' in data){
        if (data.state == this.state.STARTING){
            ans.STATE = this.state.RUNNING;
        } else if (data.state == this.state.STOPPING){
            ans.STATE = this.state.STOP;
        }
    }
    return ans;
}
Vgw.prototype.parseApiToFdbData = function(data){
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
    ans['poolid'] = lc_utils.bget(data, 'gw_poolid');
    return ans;
}

Vgw.prototype.parseBdbToFdb = function(data){
    var cols = this.tableCols, key='';
    var ans = {};
    if ('GW_POOLID' in data){
        data['POOLID'] = data.GW_POOLID;
        delete(data.GW_POOLID);
    }
    for (var i=0; i<cols.length; i++){
        key = cols[i].toUpperCase();
        if (key in data){
            ans[cols[i]] = data[key];
        } else if(cols[i] in data){
            ans[cols[i]] = data[cols[i]];
        }
    }
    //parse ip
    for(var i=1; i<=3; i++){
        if (('IF'+i) in data){
            var ifdata = data['IF'+i];
            ans['isp'+ifdata['ISP']] = {'ips':ifdata.IPS, 'bandwidth':ifdata.BW, 'ip_num':ifdata.IPS.length};
        }
    }
    if ('vdcid' in ans){
        delete(ans.vdcid);
    }
    if ('vcloudid' in ans){
        delete(ans.vcloudid);
    }
    ans['id'] = data['LCID'];

    return ans;
};
Vgw.prototype.parseBdbsToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = {DATA:[], OPT_STATUS:data.OPT_STATUS};

    for(var j=0; j<data.DATA.length; j++){
        result.DATA.push(this.parseBdbToFdb(data.DATA[j]));
    }
    return result;
}
Vgw.prototype.parseBdbToFdbData = function(data){
    logger.info(util.inspect(data));
    var result = {DATA:'', OPT_STATUS:data.OPT_STATUS, TYPE:data.TYPE};
    result.DATA = this.parseBdbToFdb(data.DATA);
    return result;
}

Vgw.prototype.create = function(data, callback, errorcallback){
    var p = this;
    p.action = 'create';
    var fdbdata = p.parseApiToFdbData(data);
    fdbdata.state = p.state.CREATING;
    fdbdata.create_time = new Date().toMysqlFormat();
    var next = function(bdbdata){
        p.insertSql(
            [p.tableName, fdbdata],
            function(ans){
                bdbdata.DATA[0]['LCID'] = ans.insertId;
                if ('HASTATE' in bdbdata.DATA[0] && bdbdata.DATA[0].HASTATE == 2){
                    var sleeptime = 1000;
                } else{
                    var sleeptime = 0;
                }
                setTimeout(function(){
                    p.sendData('/v1/vgws', 'post', bdbdata, function(sCode, rdata){
                        if (sCode == 200){
                            logger.info('remote server res:', rdata);
                            var res_data = p.parseBdbsToFdbData(rdata);
                            var newdata = res_data.DATA[0];
                            if (res_data.OPT_STATUS != 'SUCCESS' || newdata.errno){
                                p.deleteSql(
                                    [p.tableName, 'id', newdata.id],
                                    function(){
                                        errorcallback(res_data);
                                    },
                                    errorcallback
                                );
                            } else{
                                newdata.state = p.state.CREATING;
                                newdata.vdcid = fdbdata.vdcid;
                                p.updateSql(
                                    [p.tableName, newdata, 'id', newdata.id],
                                    function(){
                                        p.setData(newdata);
                                        callback(res_data);
                                    },
                                    errorcallback
                                );
                            }
                        } else{
                            errorcallback(sCode);
                        }
                    },
                    errorcallback);
                }, sleeptime)
            },
            errorcallback
        );
    };
    p.parseApiToBdbData(data, next, true);
}

Vgw.prototype.update = function(data, callback, errorcallback){
    logger.debug('send updating vgw' + data.id);
    var p = this;
    var fdbdata = p.parseApiToFdbData(data);
    var bdbdata = p.parseModifyApiToBdbData(data);

    var t = new flow.serial([
        function(a, f){
            p.selectSql(
                [p.tableName, 'id', a],
                function(ans){
                    if (ans.length>0){
                        data.lcuuid = ans[0].lcuuid;
                        f(ans[0].lcuuid);
                    }
                    else{
                        t.STD_END(function(){logger.info('vgw '+a+' not found')});
                        f();
                    }
                },
                logger.info
            );
        },

        function(a, f){
            bdbdata.LCUUID = a
            p.sendData('/v1/vgws/'+bdbdata.LCUUID, 'patch', bdbdata, function(sCode, rdata){
                    if (sCode == 200){
                        p.updateSql(
                            [p.tableName, fdbdata, 'lcuuid', data.lcuuid],
                            function(ans){
                                logger.info('rdata');
                                callback(rdata);
                            },
                            function(e){
                                errorcallback(e);
                                f(a);
                            }
                        )
                    } else{
                        logger.info('rdata');
                        errorcallback(sCode);
                        f(a);
                    }
            }, function(e){errorcallback(e), f(a)});
        }
    ]);
    t.fire(data.id, function(data){})

};

Vgw.prototype.start = function(data, callback, errorcallback){
    logger.debug('starting vgw', data);
    var p = this;
    p.action = 'start';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.state = p.state.STARTING;
                p.update(data, callback, errorcallback);
            } else{
                logger.error('vgw id %d not found', data.id);
                errorcallback(400)
            }
        },
        errorcallback
    );
}
Vgw.prototype.stop = function(data, callback, errorcallback){
    logger.debug('stopping vgw', data);
    var p = this;
    p.action = 'stop';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                data.lcuuid = ans[0].lcuuid;
                data.state = p.state.STOPPING;
                p.update(data, callback, errorcallback);
            } else{
                logger.error('vgw id %d not found', data.id);
                errorcallback(400)
            }
        },
        errorcallback
    );
}
Vgw.prototype.modify = function(data, callback, errorcallback){
    logger.debug('modifying vgw', data);
    var p = this;
    p.action = 'modify';
    p.selectSql(
        [p.tableName, 'id', data.id],
        function(ans){
            if (ans.length > 0){
                p.selectSql(
                    [p.tableName, 'vdcid', ans[0].vdcid],
                    function(ans){
                        var t=0;
                        for (var i=0; i<ans.length; i++){
                            data.lcuuid = ans[i].lcuuid;
                            p.update(data, function(d){t++; if(t == ans.length) callback(d)}, function(e){ if(t++ == ans.length)errorcallback(e)});
                        }
                    },
                    errorcallback
                );
            } else{
                logger.error('vgw id %d not found', data.id);
                errorcallback(400)
            }
        },
        errorcallback
    );
}

Vgw.prototype.del = function(data, callback, errorcallback){
    logger.debug('deleting vgw', data);
    var p = this;
    p.action = 'delete';
    var fdbdata = p.parseApiToFdbData(data);
    if ('lcuuid' in fdbdata){
        delete(fdbdata.lcuuid);
    }
    var next = function(){
        p.selectSql(
            [p.tableName, 'id', data.id],
            function(vmans){
                if (vmans.length > 0){
                    data.lcuuid = vmans[0].lcuuid;

                    p.sendData('/v1/vgws/'+data.lcuuid, 'delete', {}, function(sCode, rdata){
                        p.updateSql(
                            [p.tableName, {state:p.state.DELETING}, 'lcuuid', data.lcuuid],
                            function(ans){
                                p.data_diff = {};
                                callback(rdata);

                            },
                            errorcallback
                        )
                        },
                        errorcallback
                    );
                } else{
                    errorcallback(404);
                }
            },
            errorcallback
        );
    }
    p.parseApiToBdbData(data, next, false);

}

Vgw.prototype.check = function(e){
    return true;
}
Vgw.prototype.writeToSql = function(callback, errorcallback, flag){
    var p = this;
    for(var i in p.data_diff){
        logger.debug('writing to sql ... ', p.data_diff);
        var vdc_isp = {}, vdc = new Vdc();
        var isp_flag = false;
        if ('isp1' in p.data_diff){
            vdc_isp['isp1'] = JSON.stringify(p.data_diff.isp1);
            isp_flag = true;
            delete(p.data_diff['isp1']);
        }
        if ('isp2' in p.data_diff){
            vdc_isp['isp2'] = JSON.stringify(p.data_diff.isp2);
            isp_flag = true;
            delete(p.data_diff['isp2']);
        }
        if ('isp3' in p.data_diff){
            vdc_isp['isp3'] = JSON.stringify(p.data_diff.isp3);
            isp_flag = true;
            delete(p.data_diff['isp3']);
        }
        if ('isp4' in p.data_diff){
            vdc_isp['isp4'] = JSON.stringify(p.data_diff.isp4);
            isp_flag = true;
            delete(p.data_diff['isp4']);
        }
        var cur_data = '';
        if (flag == true){
            p.deleteSql(
                    [p.tableName, 'id', p.data.id],
                    function(ans){
                        var msg = {type:'user', target:p.data.userid, msg:{action:'delete', state:'done', type:'vgw', id:p.data.lcuuid}};
                        p.sendToMsgCenter(msg);

                    },
                    function(){logger.info('delete failed of vgw '+p.data.id); f(a)}
                );
        } else{
            var updateVgw = new flow.parallel([
                function(a, f){
                if (isp_flag) vdc.updateSql([vdc.tableName, vdc_isp, 'id', p.data.vdcid], function(){logger.debug('isp_diff stored to sql'); f(a)}, function(e){logger.error(e); f(a)}); else f(a)},
                function(a, f){logger.info('fsddsaf');p.updateSql([p.tableName, p.data_diff, 'id', p.data.id], function(){logger.debug('data_diff stored to sql'); f(a)}, function(e){logger.log(e); f(a)})},
            ]);
            var progress = new flow.serial([
                updateVgw,
                function (a, f){
                    if ('lcuuid' in p.data_diff){
                        var sqlParams = [p.tableName, 'lcuuid', p.data_diff.lcuuid];
                    } else if ('id' in p.data){
                        var sqlParams = [p.tableName, 'id', p.data.id];
                    } else{
                        throw new Error('id or lcuuid not found in data_diff/data');
                    }
                    p.selectSql(
                        sqlParams,
                        function(ans){
                            if (ans.length > 0){
                                cur_data = ans[0];
                                f(a);
                            }
                        },
                        logger.info
                    )
                }
            ]);
            progress.fire('', function(){
                logger.info('write to vgw sql end');
                var action_status = p.getActionStatus(cur_data);
                var msg = {type:'user', target:cur_data.userid, msg:{action:p.action, state:action_status, type:'vgw', id:cur_data.lcuuid}};
                p.sendToMsgCenter(msg);
                callback();
            });
        }
        return;
    }
    logger.debug('data_diff is null, ignore writing to sql');
    callback();
}
Vgw.prototype.default_event_parser = function(data, callback, errorcallback){
    var p = this;
    if (data.state == this.state.DELETED){
        this.deleteSql([p.tableName, 'lcuuid', data.lcuuid], function(){
            callback();
            //p.sendToDataCenter({target:});
        }, logger.info);
    } else{
        logger.info(p.data_diff);
        p.writeToSql(callback, errorcallback);
    }
}


module.exports=Vgw;
