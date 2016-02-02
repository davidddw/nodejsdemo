var Obj = require('./obj.js');
var logger = require('./logger.js');
var flow = require('./flow.js');
var util = require('util');
var constr = require('./const.js');
var assert = require('assert');
var constr = require('./const.js')


var Product = function(){
    Obj.call(this);
}
util.inherits(Product, Obj);

Product.prototype.getAll = function(callback, errorcallback){
    var p = this;
    var steps = [];
    var app = new flow.parallel(steps);
    steps.push(function(a, f){
         p.executeSql('select * from product_specification'+constr.SQL_VERSION)(
            [],
            function(data){f('product_specification', data)},
            function(){f('product_specification', [])}
         )
    });
    steps.push(function(a, f){
         p.executeSql('select * from unit_price')(
            [], function(data){f('unit_price', data)}, function(){f('product_specification', [])}

         )
    });
    steps.push(function(a, f){
         p.executeSql('select * from pricing_plan')(
            [], function(data){f('pricing_plan', data)}, function(){f('product_specification', [])}
         )
    });
    app.fire_with_dict_data('', function(ans){callback({DATA:ans, OPT_STATUS:constr.OPT.SUCCESS})});
}

Product.prototype.get = function(filter, callback){
    var p = this;
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled, onRejected){
        //if sync filter is not set, use async filter
        filter = filter ? filter : placeHolder;
        callback = callback ? callback : function(data){return data;};
        var init_sql = 'select * from product_specification'+ constr.SQL_VERSION +' where 1=1';
        var values = [];
        assert(typeof filter == 'object')
        for (var i in filter){
            init_sql += ' and ?? = ? ';
            values.push(i);
            values.push(filter[i]);
        }
        p.executeSql(init_sql)(values,
            function(data){
                if (data.length){
                    onFullfilled(callback(data));
                } else{
                    Q.reject({'OPT_STATUS': constr.OPT.FAIL,
                            'FILTER': filter,
                            'MSG': 'product not found'
                    })
                }
            },
            function(){
                Q.reject({
                    'OPT_STATUS': constr.OPT.FAIL,
                    'MSG': 'exec sql error',
                })
            }
        );
    });
}

/*
var a = new Product();
a.get().resolve({'product_type':1}, console.log, console.log);
*/

module.exports=Product;
