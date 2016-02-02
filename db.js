var flow = require('./flow.js');
var obj = require('./obj.js');
var constr = require('./const.js');
var assert = require('assert');
var logger = require('./logger.js');

var db = {
    fetch: function(tableName, filter, dataParse){
        var p = this;
        var Q = new flow.Qpack(flow.serial);
        return Q.then(function(placeHolder, onFullfilled, onRejected){
            //if sync filter is not set, use async filter
            filter = filter ? filter : placeHolder;
            dataParse = dataParse ? dataParse : function(data){return data;};
            var init_sql = 'select * from ' + tableName + ' where 1=1';
            var values = [];
            assert(typeof filter == 'object');
            for (var i in filter){
                if (filter[i].constructor == Array){
                    init_sql += ' and ?? in (?) ';
                } else{
                    init_sql += ' and ?? = ? ';
                }
                values.push(i);
                values.push(filter[i]);
            }
            obj.prototype.executeSql(init_sql)(values,
                function(data){
                    if (data.length){
                        onFullfilled(dataParse(data));
                    } else{
                        Q.reject({'OPT_STATUS': constr.OPT.FAIL,
                                'FILTER': filter,
                                'MSG': 'filter not found'
                        });
                        onFullfilled(dataParse([]));
                    }
                },
                function(){
                    Q.reject({
                        'OPT_STATUS': constr.OPT.FAIL,
                        'MSG': 'exec sql error',
                    });
                    onFullfilled();
                }
            );
        });
    },
    insert: function(tableName, data, dataParse){
        var p = this;
        var Q = new flow.Qpack(flow.serial);
        return Q.then(function(placeHolder, onFullfilled, onRejected){
            //if sync data is not set, use async filter
            data = data ? data : placeHolder;
            dataParse = dataParse ? dataParse : function(data){return data;};
            obj.prototype.insertSql([tableName, data],
                function(data){
                    if ('insertId' in data){
                        onFullfilled(dataParse(data));
                    } else{
                        Q.reject({'OPT_STATUS': constr.OPT.FAIL,
                                'DATA': data,
                                'MSG': 'insert sql failed'
                        });
                        onFullfilled();
                    }
                },
                function(){
                    Q.reject({
                        'OPT_STATUS': constr.OPT.FAIL,
                        'MSG': 'exec sql error',
                    });
                    onFullfilled();
                }
            );
        });

    },
    update: function(tableName, data, dataParse){
        var Q = new flow.Qpack(flow.serial);
        return Q.then(function(placeHolder, onFullfilled, onRejected){
            //if sync data is not set, use async data
            data = data ? data : placeHolder;
            dataParse = dataParse ? dataParse : function(data){return data;};
            var init_sql = 'update ' + tableName +' set ';
            var values = [];
            var ops = [];
            assert(typeof data.data == 'object');
            assert(typeof data.cond == 'object');
            for (var i in data.data){
                ops.push(' ?? = ? ');
                values.push(i);
                values.push(data.data[i]);
            }
            init_sql += ops.join(',') + ' where ';
            ops = [];
            for (var j in data.cond){
                ops.push(' ?? = ? ');
                values.push(j);
                values.push(data.cond[j]);
            }
            init_sql += ops.join('and');
            obj.prototype.executeSql(init_sql)(values,
                function(data){
                    if (data.length){
                        onFullfilled(dataParse(data));
                    } else{
                        Q.reject({'OPT_STATUS': constr.OPT.FAIL,
                                'FILTER': data.cond,
                                'MSG': 'cond not found'
                        });
                        onFullfilled();
                    }
                },
                function(){
                    Q.reject({
                        'OPT_STATUS': constr.OPT.FAIL,
                        'MSG': 'exec sql error',
                    });
                    onFullfilled();
                }
            );
        });
    },
};

module.exports = db;
