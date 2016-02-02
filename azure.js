var Obj = require('./obj.js');
var Instance = require('./instance.js');
var util = require('util');
var lc_utils = require('./lc_utils.js');
var constr = require('./const.js');

var Azure = function(){
    Obj.call(this);
}
util.inherits(Azure, Obj);

Azure.prototype.get = function(data, callback, errorcallback) {
    var p = this;
    var filter = {};
    var lcuuid = '';

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('epc_id' in data) {
        filter.epc_id = data.epc_id;
    }
    if ('domain' in data) {
        filter.domain = data.domain;
    }
    if ('page_index' in data) {
        filter.page_index = data.page_index;
    }
    if ('page_size' in data) {
        filter.page_size = data.page_size;
    }
    if ('1' in data) {
        lcuuid = '/' + data[1]
    }

    p.sendAzureData('/v1/azure-' + data[0] + lcuuid, 'get', filter,
        function(code, resp){
            if (resp.OPT_STATUS == 'SUCCESS') {
                callback(resp);
            } else {
                errorcallback(code, resp);
            }
        },
        function(code, resp){
            var response = {};
            try {
                response = JSON.parse(JSON.stringify(resp));
            } catch(e) {
                response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                response.DESCRIPTION = "Azure Error";
            }
            errorcallback(code, response);
        }
    );
}

Azure.prototype.create = function(data, params, callback, errorcallback) {
    var p = this;
    var username = '';
    var password = '';
    var filter = '';

    if ('username' in params) {
        username = params.username;
    }
    if ('password' in params) {
        password = params.password;
    }
    if (params[0] == 'vpn-connections') {
        filter = '/?' + 'username=' + username + '&&password=' + password + '&&';
    }

    p.sendAzureData('/v1/azure-' + params[0] + filter, 'post', data,
        function(code, resp){
            if (resp.OPT_STATUS == 'SUCCESS') {
                callback(resp);
            } else {
                errorcallback(code, resp);
            }
        },
        function(code, resp){
            var response = {};
            try {
                response = JSON.parse(JSON.stringify(resp));
            } catch(e) {
                response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                response.DESCRIPTION = "Azure Error";
            }
            errorcallback(code, response);
        }
    );
}

Azure.prototype.del = function(data, callback, errorcallback) {
    var p = this;
    var filter = {};

    if ('userid' in data) {
        filter.userid = data.userid;
    }
    if ('domain' in data) {
        filter.domain = data.domain;
    }
    if ('username' in data) {
        filter.username = data.username;
    }
    if ('password' in data) {
        filter.password = data.password;
    }

    p.sendAzureData('/v1/azure-' + data[0] + '/' + data[1], 'delete', filter,
        function(code, resp){
            if (resp.OPT_STATUS == 'SUCCESS') {
                callback(resp);
            } else {
                errorcallback(code, resp);
            }
        },
        function(code, resp){
            var response = {};
            try {
                response = JSON.parse(JSON.stringify(resp));
            } catch(e) {
                response.OPT_STATUS = constr.OPT.SERVER_ERROR;
                response.DESCRIPTION = "Azure Error";
            }
            errorcallback(code, response);
        }
    );
}

module.exports=Azure;
