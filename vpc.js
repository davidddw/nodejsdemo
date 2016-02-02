var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var Instance = require('./instance.js');

var Vcloud = function(){
    Obj.call(this);
    this.tableCols = [
        'name',
        'userid'
    ];
}
util.inherits(Vcloud, Obj);
Vcloud.prototype.state = {
};
Vcloud.prototype.tableName = 'fdb_vpc_v2_2';
Vcloud.prototype.type = 'vcloud';
Vcloud.prototype.constructor = Vcloud;

Vcloud.prototype.parseApiToBdbData = function(data){

}

Vcloud.prototype.create = function(data, callback, errorcallback){
    var p = this;
    p.sendData(
        '/v1/vclouds', 'post', {NAME:data.name, USER:data.userid}, function(sCode, rans){
            if ('DATA' in rans && 'LCUUID' in rans.DATA){
                p.insertSql(
                    [p.tableName, {name:data.name, userid:data.userid, lcuuid:rans.DATA.LCUUID, create_time:new Date().toMysqlFormat()}],
                    function(rdata){
                        callback({id:rdata.insertId});
                    },
                    errorcallback
                )
            }
        },
        errorcallback
    );
}
//var a = new Vcloud();
//a.update({id:1004, name:'fsd'}, console.log, console.log);
module.exports=Vcloud;
