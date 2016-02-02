var Obj = require('./obj.js');
var util = require('util');
var PM = function(){Obj.call(this);this.tableCols = ['ip'];}
util.inherits(PM, Obj);

PM.prototype.state = {};
PM.prototype.tableName = 'ipmi_info_v2_2';
PM.prototype.type = 'pm';
PM.prototype.constructor = PM;
PM.prototype.parseApiToBdbData = function(data){}

PM.prototype.mdf_deploy_job = function(data, callback, errorcallback){
  var pm_job = this;
	var condition = 'update ?? set action=\'2\',finish_time=SYSDATE() where ??=?';
  var param = [];
  param.push('ipmi_ip');
  param.push(data.ip);
  pm_job.executeSql(condition)([pm_job.tableName].concat(param),function(){ callback({ip:data.ip});},errorcallback)  ;
}
module.exports=PM;


