var Obj = require('./obj.js');
var flow = require('./flow.js');
var logger = require('./logger.js');
var util = require('util');

var OsTemplate = function(){
}

util.inherits(OsTemplate, Obj);

OsTemplate.prototype.tableName = 'template_os_v2_2';
OsTemplate.prototype.get = function(data, callback, errorcallback){
    var p = this;
    p.action = 'get';

    var condition = 'select * from ?? where true';
    var params = [];

    if (!('state' in data)){
        data.state = 0;
    }
    for (var k in data){
        condition += ' and ??=?';
        params.push(k);
        params.push(data[k]);
    }
    p.executeSql(condition)(
        [OsTemplate.prototype.tableName].concat(params),
        function(ans){
            callback(ans);
        },
        function(a){errorcallback(a)}
    );

}
module.exports=OsTemplate;
