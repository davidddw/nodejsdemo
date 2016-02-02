//watch event pop from livecloud using socket
var net = require('net'), fs = require('graceful-fs');
var logger = require('./logger.js')
var dgram = require('dgram')

try{
    fs.unlinkSync('/tmp/node-connection-sock')
} catch(e){
}

var connection = function(listener){ return net.createServer(function(socket){
    //logger.info('server connected');
    socket.setEncoding('utf8')
    socket.setNoDelay()
    socket.on('data', function(data){
        logger.info('listener received data', data);
        listener.map(JSON.parse(data.toString()));
    })
    socket.on('error', function(err){
    })
}).listen('/tmp/node-connection-sock')};

var udpConnection = function(listeners){
    var s = dgram.createSocket('udp4');
    s.on("message", function(msg, rinfo){
        listeners.forEach(function(listener){
            listener.map(JSON.parse(msg.toString())) ;
        })
    });
    s.on("listening", function(){
        var add = s.address();
        logger.info('dgram listener listening at ', add);
    });
    s.on('error', function(err){
        logger.info('dgram listener error');
    });
    s.bind(20014);
}

module.exports=udpConnection;
