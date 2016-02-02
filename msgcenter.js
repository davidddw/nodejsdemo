var net = require('net'),
    fs = require('fs');


var express = require('express')
var app = express();
var options = {
    key : fs.readFileSync('/etc/httpd/conf/server.pem'),
    cert : fs.readFileSync('/etc/httpd/conf/server.crt'),
};
var server = require('https').createServer(options, app);
var io = require('socket.io').listen(server);
io.set('log level', 0);

var winston = require('winston');
var logger = new (winston.Logger)({
    exitOnError : false,
    transports : [
        new (winston.transports.Console)(),
        new (winston.transports.File)({ filename : '/var/log/lcwebapi_msgcenter.log'})
    ],
    exceptionHandlers:[
        new winston.transports.File({filename : '/var/log/lcwebapi_msgcenter.log'})
    ],
})
//

try{
    fs.unlinkSync('/tmp/lcwebapi_msgcenter-sock')
} catch(e){
}


var user_sockets = {};
var socket_user_map = {};
// msg = {'type':'user',target:3, msg:{action:'stop', state:'done', code:0}}
var deal = function(msg){
    logger.info(msg)
    if (msg.type == 'user'){
        userid = ''+msg.target;
        logger.info('userid is '+userid)

        if (userid in user_sockets){
            //logger.info('new msg')
            for (var i in user_sockets[userid]){
                logger.info(i)
                try {
                    user_sockets[userid][i].emit('update', msg.msg);
                } catch(e){
                    logger.info('sendmsg error:');
                    logger.error(e);
                }
            }

        }

        //for admin
        if (userid != '1' && '1' in user_sockets){
            for (var i in user_sockets['1']){
                logger.info(i)
                try {
                user_sockets['1'][i].emit('update', msg.msg);
                } catch(e){
                    logger.info('sendmsg error:');
                    logger.error(e);
                }
            }
        }
    }

}

var login = function(userid){
    user_sockets[userid] = {};
}

var logout = function(){
}

net.createServer(function(socket){
    //logger.info('server connected');
    socket.setEncoding('utf8')
    socket.setNoDelay()
    socket.on('data', function(data){
        //logger.info(data)
        msg = eval(data)
        for (var i in msg){
            deal(msg[i])
        }
        //send to LCRLR
        try{
            var a = net.connect({path : '/tmp/instance-sock'}, function(){
                    logger.info(msg)
                    data = JSON.stringify(msg)
                    a.write(data.length+' '+data)
                });
            //a.setNoDelay();
        } catch(e){
            logger.info('can not connect to instance acceptor');
            logger.error(e);
        }
    })
    socket.on('error', function(err){
        logger.info('ignoring error '+err)
    })
}).listen('/tmp/node-sock');

server.listen(20100);
io.sockets.on('connection', function(socket){
    //logger.info('socket connected');
    socket.on('register', function(userid){
        userid = userid + '';
        if (userid in user_sockets){
            user_sockets[userid][socket.id] = socket;
        } else{
            user_sockets[userid] = {}
            user_sockets[userid][socket.id] = socket;
        }
        socket.emit('confirmconnect');
        socket_user_map[socket.id] = userid
        logger.info('socket connected')
        //logger.info(user_sockets)
        logger.info(socket_user_map)
    })
    socket.on('disconnect', function(){
        logger.info('disconnect from '+socket.handshake.address.address)
        if (socket.id in socket_user_map)
            delete(user_sockets[socket_user_map[socket.id]][socket.id]);
        else{
            logger.info('wtf is '+socket.id)
            logger.info(socket);
        }
        delete(socket_user_map[socket.id])
        logger.info('socket disconnect');
        //logger.info(user_sockets);
    })
    var a = null;
})


