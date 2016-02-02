var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var Instance = require('./instance.js');

var Vdc = function(){
    Obj.call(this);
    this.tableCols = [
        'name',
        'vcloudid',
        'userid',
        'flag',
        'vgwhamode'
    ];
}
util.inherits(Vdc, Obj);
Vdc.prototype.state = {
};
Vdc.prototype.tableName = 'fdb_vdc_v2_2';
Vdc.prototype.type = 'vdc';
Vdc.prototype.constructor = Vdc;
Vdc.prototype.parseApiToBdbData = function(data, callback, errorcallback){
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
    if ('passwd' in data){
        ans.PASSWD = data.passwd;
    }
    if ('FLAG' in ans){
        delete(ans.FLAG);
    }
    if ('VGWHAMODE' in ans){
        delete(ans.VGWHAMODE);
    }

    var p = this;
    if ('vcloudid' in data){
        p.selectSql(
            ['fdb_vpc_v2_2', 'id', data.vcloudid],
            function(rdata){
                if (rdata.length){
                    ans.VCLOUD_LCUUID = rdata[0].lcuuid;
                    delete(ans.VCLOUDID);
                    callback(ans);
                } else{
                    errorcallback(400, {ERR_MSG:'vcloudid not found'})
                }
            },
            errorcallback
        );
    }
    return ans;
}
Vdc.prototype.parseApiToFdbData = function(data){
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
Vdc.prototype.create = function(data, callback, errorcallback){
    logger.debug('creating vdc ');
    var p = this;
    var fdbdata = p.parseApiToFdbData(data);
    fdbdata.create_time = new Date().toMysqlFormat();
    var emptyisp = JSON.stringify({ips:[], ip_num:0, bandwidth:0});
    fdbdata.isp1 = emptyisp;
    fdbdata.isp2 = emptyisp;
    fdbdata.isp3 = emptyisp;
    fdbdata.isp4 = emptyisp;
    var next = function(bdbdata){
    p.insertSql(
        [p.tableName, fdbdata],
        function(ans){
            bdbdata['LCID'] = ans.insertId;
            p.sendData('/v1/vdcs', 'post', bdbdata, function(sCode, data){
                data.DATA.id=ans.insertId;
                p.updateSql(
                    [p.tableName, {lcuuid:data.DATA.LCUUID}, 'id', data.DATA.id],
                    function(){callback(data)},
                    errorcallback
                );
            });
        },
        errorcallback
        );
    }
    p.parseApiToBdbData(data, next, errorcallback);
}
Vdc.prototype.update = function(data, callback, errorcallback){
    logger.debug('updating vm' + data.id);
    var p = this;
    var fdbdata = p.parseApiToFdbData(data);
    var bdbdata = p.parseApiToBdbData(data);
    logger.info(fdbdata);
    this.updateSql(
        [this.tableName, fdbdata, 'id', fdbdata.id] ,
        function(ans){
            if (ans.changedRows == 1){
                p.sendData('/v1/vdcs', 'patch', bdbdata, function(sCode, data){callback(data)});
            }
        },
        errorcallback
    );
}
Vdc.prototype.check = function(e){
    return true;
};
//var a = new Vdc();
//a.update({id:1004, name:'fsd'}, console.log, console.log);
module.exports=Vdc;
