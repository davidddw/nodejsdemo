var logger = require('./logger.js');
var constr = require('./const.js');
var util = require('util');
var Obj = require('./obj.js');
var flow = require('./flow.js');
var lc_utils = require('./lc_utils.js');

var Domain = function(){
    Obj.call(this);
}

util.inherits(Domain, Obj);

Domain.prototype.tableName = 'domain_v2_2';

Domain.prototype.get = function(data, callback, errorcallback){
    var p = this;

    var condition = 'select * from ?? where true';
    var param = [];
    var flow_steps = [];
    var domains = [];
    var app = new flow.serial(flow_steps);

    if ('lcuuid' in data) {
        condition += ' and ??=?';
        param.push('lcuuid');
        param.push(data.lcuuid);
    }

    if ('name' in data) {
        condition += ' and ??=?';
        param.push('name');
        param.push(data.name);
    }

    if ('role' in data) {
        condition += ' and ??=?';
        param.push('role');
        param.push(data.role);
    }

    flow_steps.push(function(a, f){p.executeSql(condition)([Domain.prototype.tableName].concat(param),
            function(ans){
                if (ans.length > 0) {
                    domains = ans;
                }
                f(a);
            },function(a){errorcallback(a), app.STD_END()}
        );
    });

    flow_steps.push(function(a, f){
        var rdata = {};

        rdata.OPT_STATUS = 'SUCCESS';
        rdata.DESCRIPTION = '';
        rdata.TYPE = 'EPC';

        if (domains.length == 0){
            if ('id' in data){
                errorcallback(404);
            } else {
                rdata.DATA = [];
                callback(rdata);
            }
        }
        else{
            if ('id' in data){
                rdata.DATA = domains[0];
            } else {
                rdata.DATA = domains;
            }
            callback(rdata);
        }
    });

    app.fire('', function(){});
}

Domain.prototype.fill_domain_for_bdb_instance = function fill_domain_for_bdb_instance(p, app, errorcallback) {
    app.list.push(function(bdb_instances, f) {
        var domain_condition = "SELECT * FROM ?? WHERE lcuuid IN (-1";
        var instances_lcuuids = [];
        var i, j;
        for (i = 0; i < bdb_instances.length; ++i) {
            if (!bdb_instances[i].DOMAIN) {
                continue;
            }
            for (j = 0; j < instances_lcuuids.length; ++j) {
                if (instances_lcuuids[j] == bdb_instances[i].DOMAIN) {
                    break;
                }
            }
            if (j >= instances_lcuuids.length) {
                instances_lcuuids.push(bdb_instances[i].DOMAIN);
                domain_condition += ",'" + instances_lcuuids[j] +"'";
            }
        }
        domain_condition += ')'

        p.executeSql(domain_condition)([Domain.prototype.tableName],
            function(ans){
                var i, j;
                var domains = [];
                for (i = 0; i < ans.length; ++i) {
                    domains.push({
                        LCUUID: ans[i].lcuuid,
                        DOMAINNAME: ans[i].name
                    });
                }
                for (i = 0; i < bdb_instances.length; i++) {
                    bdb_instances[i].DOMAIN_INFO = null;
                    for (j = 0; j < domains.length; ++j) {
                        if (bdb_instances[i].DOMAIN == domains[j].LCUUID) {
                            bdb_instances[i].DOMAIN_INFO = domains[j];
                            break;
                        }
                    }
                }
                f(bdb_instances);
            },
            function(a){
                errorcallback(a, {'OPT_STATUS': constr.OPT.SERVER_ERROR,'DESCRIPTION': 'Exec sql error, select from domain_v2_2 failed.'});
                p.STD_END();
            }
        );
    });
}

Domain.prototype.set_bss_domain = function(data, callback, errorcallback){
    var p = this;
    var steps = [];
    var app = new flow.serial(steps);
    data = lc_utils.lowerJsonKey(data);
    console.log(data);
    steps.push(function(data, f){
        p.deleteSql([p.tableName, 'role', 1],
            f,
            function(){app.STD_END(function(){errorcallback(500)})});
    });
    steps.push(function(a, f){
        p.insertSql([p.tableName, {
                lcuuid: data.lcuuid,
                role: 1,
                name: data.name,
                ip: data.ip,
                public_ip: data.public_ip,
            }],
            f,
            function(){app.STD_END(function(){errorcallback(500)})});
    });
    app.fire(data, function(data){
        if (!app.endFlag)
            callback(200);
    })
}

module.exports = Domain;
