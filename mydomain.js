var domain = require('domain');


module.exports = function(func){
    var F = function(){};
    var dom = domain.create();
    F.prototype.catch = function(errHandler){
        var args = arguments;
        dom.on('error', function(err){
            errHandler(err.stack);
        }).run(function(){
            func.call(null, args);
        });
        return this;
    }
    return new F();
}
