var logger = require('./logger.js');
var util = require('util');
var Instance = require('./instance.js');
var Obj = require('./obj.js');

var InstanceRole = function(){
    Obj.call(this);
    this.tableCols = [
    ];
}

util.inherits(InstanceRole, Obj);

InstanceRole.prototype.type = 'instance-role';
InstanceRole.prototype.constructor = InstanceRole;

InstanceRole.prototype.get = function(data, callback, errorcallback){
    var rdata = {};

    rdata.OPT_STATUS = 'SUCCESS';
    rdata.DESCRIPTION = '';
    rdata.TYPE = 'INSTANCE_ROLE';

    if ('instance_type' in data) {
        logger.info(INSTANCE_ROLE_ARRAY.length)
        for (var i=0; i<INSTANCE_ROLE_ARRAY.length; i++){
            if (INSTANCE_ROLE_ARRAY[i].INSTANCE_TYPE == data.instance_type){
                rdata.DATA = INSTANCE_ROLE_ARRAY[i];
                callback(rdata);
                return;
            }
        }
        rdata.OPT_STATUS = 'FAIL';
        rdata.DESCRIPTION = 'no instance-type found';
        callback(rdata);
    }
    else{
        rdata.DATA = INSTANCE_ROLE_ARRAY;
        callback(rdata);
    }

}

module.exports=InstanceRole;

