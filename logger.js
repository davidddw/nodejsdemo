//Object.defineProperty(global, '__stack', {
//    get: function(){
//        var orig = Error.prepareStackTrace;
//        Error.prepareStackTrace = function(_, stack){ return stack; };
//        var err = new Error;
//        Error.captureStackTrace(err, arguments.callee);
//        var stack = err.stack;
//        Error.prepareStackTrace = orig;
//        return stack;
//    }
//});
//
//Object.defineProperty(global, '__line', {
//    get: function(){
//        return __stack[2].getLineNumber();
//    }
//});
//Object.defineProperty(global, '__file', {
//    get: function(){
//        return __stack[2].getFileName();
//    }
//});

/*
var log_format = function(f) {
    return function() {
        var a = Array.prototype.slice.call(arguments, 0);
        format = a.shift();
        a.unshift(Date().toString());
        format = '%s ' + format;
        a.unshift(format)
        a.push('at line', __line, 'in file', __file);
        f.apply(this, a);
    }
}

var logger = {
    info : log_format(console.log),
    error : log_format(console.trace),
    debug : log_format(console.log),
}
*/
var winston = require('winston');
var util = require('util');
var logger_opts = {
    filename: '/var/log/lcwebapi.log',
    datePattern: '.yyyy-MM-dd',
    json: false,
    handleExcetion: true,
    timestamp: function(){
        return new Date().toMysqlFormat();
    }
}
var logger = new (winston.Logger)({
    exitOnError : false,
    transports : [
        new (winston.transports.Console)({
            colorize: false,
            timestamp: function(){
                return new Date().toMysqlFormat()+ ':'+ new Date().getMilliseconds()+' '+Date.now();
            }
        }),
        new (winston.transports.DailyRotateFile)(logger_opts)
    ],
})
var logger_info_old = logger.info;
logger.info = function(msg) {
    var fileAndLine = traceCaller(1);
    var newMsg = [fileAndLine];
    for (var i=0; i<arguments.length; i++){
        newMsg.push(util.inspect(arguments[i], false, null));
    }
    return logger_info_old.apply(this, newMsg);
}


function traceCaller(n) {
  if( isNaN(n) || n<0) n=1;
  n+=1;
  var s = (new Error()).stack
    , a=s.indexOf('\n',5);
  while(n--) {
    a=s.indexOf('\n',a+1);
    if( a<0 ) { a=s.lastIndexOf('\n',s.length); break;}
  }
  b=s.indexOf('\n',a+1); if( b<0 ) b=s.length;
  a=Math.max(s.lastIndexOf(' ',b), s.lastIndexOf('/',b));
  b=s.lastIndexOf(':',b);
  s=s.substring(a+1,b);
  return s;
}
module.exports = logger;
