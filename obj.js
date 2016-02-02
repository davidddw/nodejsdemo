var emitter = require('events').EventEmitter;
var logger = require('./logger.js');
var sqlHandler = require('./sql.js');
var util = require('util');
var Api = require('./api.js');
var net = require('net'), fs = require('graceful-fs');
var constr = require('./const.js');
/**********parent class*********/
var Obj = function(){
    this.on('started', function(){logger.info('start done')});
    this.data = '';
    this.data_diff = {cpu_num:0};
    this.event_handler = {};
    this.tableCols = [];
    this.action = '';
    emitter.call(this);
};
util.inherits(Obj, emitter);

Obj.prototype.domain_tableName = 'domain_v2_2';
Obj.prototype.user_tableName = 'fdb_user_v2_2';

Obj.prototype.executeSql = function(prefix){
    return function(data, callback, errorcallback){
        //logger.info('sql execute data', data);
        sqlHandler.getConnection(function(err, connection){
            if (err){
                logger.error(util.inspect(err));
                return errorcallback(500);
            }
            connection.query(prefix, data, function(err, ans){
                //logger.info(this.sql);
                connection.release();
                if (err){
                    logger.error(util.inspect(err));
                    errorcallback(500);
                } else{
                    //logger.debug(ans);
                    callback(ans);
                }
            })

        })
    }
};
Obj.prototype.getTableCols = function(){
    var p = this;
    sqlHandler.getConnection(function(err, connection){
        connection.query('show columns from ??', p.tableName, function(err, rows, fields){
            logger.debug(this.sql);
            if (err){
                throw err;
            } else{
                for (var i=0; i<rows.length; i++){
                    p.tableCols.push(rows[i].Field);
                }
            }
            connection.release();
        });
    })
}
Obj.prototype.insertSql = Obj.prototype.executeSql('insert into ?? set ?');
Obj.prototype.updateSql = Obj.prototype.executeSql('update ?? set ? where ??=?');
Obj.prototype.deleteSql = Obj.prototype.executeSql('delete from ?? where ??=?');
Obj.prototype.selectSql = Obj.prototype.executeSql('select * from ?? where ??=?');
Obj.prototype.sendData  = function(url, method, data, callback, errorcallback){
    Api.api._callfunc(method)(url, data, function(sCode, d){callback(sCode, d);}, errorcallback);
};
Obj.prototype.sendBackupData  = function(url, method, data, callback, errorcallback){
    Api.backup_api._callfunc(method)(url, data, function(sCode, d){callback(sCode, d);}, errorcallback);
};
Obj.prototype.sendAzureData  = function(url, method, data, callback, errorcallback){
    Api.azure_api._callfunc(method)(url, data, function(sCode, d){callback(sCode, d);}, errorcallback);
};
Obj.prototype.callbackWeb  = function(url, method, data, callback, errorcallback){
    var bss_web_ip = constr.getBss();
    var web_api = Api.gen_api({ip:bss_web_ip, port:443, web:true, ssl:true});
    web_api._callfunc(method)(url, data, function(sCode, d){callback(sCode, d);}, errorcallback);
};

Obj.prototype.callCharge  = function(url, method, data, callback, errorcallback){
    var bss_web_ip = constr.getBss();
    var web_api = Api.gen_api({ip:bss_web_ip, port:443, web:false, ssl:true, prefix:"chargemod"});
    web_api._callfunc(method)(url, data, function(sCode, d){callback(sCode, d);}, errorcallback);
};

Obj.prototype.getSession = function(userid, callback, errorcallback){
    var p = this;
    var condition = 'select session,useruuid from ?? where ??=?';
    p.executeSql(condition)([Obj.prototype.user_tableName, 'id', userid],function(ans){
        callback(ans);
    }, errorcallback);
}
Obj.prototype.callCashier  = function(url, method, data, callback, errorcallback){
    Api.cashier_api._callfunc(method)(url, data, function(sCode, d){callback(sCode, d);}, errorcallback);
};
// obj data is the same with fdb so depth should be 1
Obj.prototype.setData = function(data){
    var t = {};
    if ('id' in this.data_diff){
        t['id'] = this.data_diff.id;
    }
    if ('lcuuid' in this.data_diff){
        t['lcuuid'] = this.data_diff.lcuuid;
    }
    this.data_diff = t;
    if (this.data == ''){
        this.data_diff = data;
        this.data = data;
        return;
    }
    for (var i in data){
        if (i in this.data){
            if (data[i] == this.data[i]){
                continue;
            }
        }
        this.data_diff[i] = data[i]
        this.data[i] = data[i]
    }
    if ('id' in this.data){
        this.data_diff['id'] = this.data['id'];
    }
}

// todo: change tcp to udp socket
// enforce sync of fdb&bdb
Obj.prototype.sendToMsgCenter = function(msg){
    msg = [msg];
    logger.info('sendToMsgCenter:', msg);
    var a = net.connect({path : '/tmp/node-sock'}, function(){
        var data = JSON.stringify(msg)
        a.end(data)
    });
    a.on('error', function(e){
        logger.error(e);
    })
    //a.setNoDelay();
}

//for db diff
Obj.prototype.makeDiff = function(pre, cur){
    var ans = {fdb:{}, bdb:{}};
    for (var i in cur){
        if (i in pre && pre[i] != cur[i]){
            ans.fdb[i] = pre[i];
            ans.bdb[i] = cur[i];
        }
    }
    return ans;
}



function twoDigits(d){
    if (0 <= d && d < 10) return "0" + d.toString();
    if (-10 < d && d < 0) return "-0"+(-1*d).toString();
    return d.toString();
}

Date.prototype.toMysqlFormat = function(){
        return this.getFullYear() + "-" + twoDigits(1 + this.getMonth()) + "-" + twoDigits(this.getDate()) + " " + twoDigits(this.getHours()) + ":" + twoDigits(this.getMinutes()) + ":" + twoDigits(this.getSeconds());

}

console.log('current time:', new Date().toMysqlFormat());
module.exports = Obj;

