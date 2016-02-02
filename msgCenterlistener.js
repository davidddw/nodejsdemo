var net = require('net'),
fs = require('fs'),
obj = require('./obj.js');

var express = require('express')
var app = express();
var options = {
        key: fs.readFileSync('/etc/httpd/conf/server.pem'),
        cert: fs.readFileSync('/etc/httpd/conf/server.crt'),
};
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
io.set('log level', 0);

var winston = require('winston');

var logger_opts = {
    filename: '/var/log/statesniffer_listener2.log',
    datePattern: '.yyyy-MM-dd',
    json: false,
    handleExcetion: true,
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
var logger = new (winston.Logger)({
    exitOnError : false,
    transports : [
        new (winston.transports.Console)({
            colorize: false,
            timestamp: true,
        }),
        new (winston.transports.DailyRotateFile)(logger_opts)
    ],
})
var logger_info_old = logger.info;
logger.info = function(msg) {
    var fileAndLine = traceCaller(1);
    var newMsg = [fileAndLine];
    for (var i=0; i<arguments.length; i++){
        newMsg.push(arguments[i]);
    }
    return logger_info_old.apply(this, newMsg);
}

//
try {
        fs.unlinkSync('/tmp/node-sock')
} catch(e) {}

var user_sockets = {};
var socket_user_map = {};
var user_name_map = {};
// msg = {'type':'user',target:3, msg:{action:'stop', state:'done', code:0}}
var deal = function(msg) {
    try{
        if (msg.type == 'print'){
            for (var useruuid in user_sockets){
                logger.info(useruuid, user_name_map[useruuid]);
                for (var i in user_sockets[useruuid]){
                    var socket = user_sockets[useruuid][i];
                    var address = socket.handshake.headers['x-real-ip'];
                    logger.info('   ', address, socket.id);
                }
            }
        }
        if (msg.type == 'user') {
            var useruuid = msg.target;
            if (useruuid in user_sockets) {
                    logger.info('useruuid is ' + useruuid)
                    //logger.info('new msg')
                    for (var i in user_sockets[useruuid]) {
                            logger.info(i)
                            try {
                                    user_sockets[useruuid][i].emit('update', msg.msg);
                            } catch(e) {
                                    logger.info('sendmsg error:');
                                    logger.error(e);
                            }
                    }

            }

            //for admin
            if (useruuid != '1' && '1' in user_sockets) {
                    for (var i in user_sockets['1']) {
                            logger.info(i)
                            try {
                                    user_sockets['1'][i].emit('update', msg.msg);
                            } catch(e) {
                                    logger.info('sendmsg error:');
                                    logger.error(e);
                            }
                    }
            }

        }
        }
        catch(e){
            logger.info(e.stack);
        }

}

var login = function(useruuid) {
        user_sockets[useruuid] = {};
}

var logout = function() {}

net.createServer(function(socket) {
        //logger.info('server connected');
        socket.setEncoding('utf8');
        socket.setNoDelay();
        socket.on('data', function(data) {
                //logger.info(data)
                // data is [{msg}, {msg}];
                msg = JSON.parse(data)
                for (var i in msg) {
                        deal(msg[i])
                }

        })
        socket.on('error', function(err) {
                logger.info('ignoring error ' + err)
        })
}).listen('/tmp/node-sock', function() {
        return fs.chmod('/tmp/node-sock', 0777);
});

server.listen(20100);
app.get('/', function(req, res) {
        res.send(__dirname + '');
})
app.use('/js', express.static(__dirname + '/js'));


var check_user_valid = function(useruuid, session, callback) {
        if (useruuid.substr(0,4) == 'page'){
            logger.info('check page with ', useruuid, session);
            useruuid = useruuid.substr(4);
            callback(useruuid);
            return;
        }
        logger.info('check user with ', useruuid, session);
        obj.prototype.executeSql('select id, username, useruuid from fdb_user_v2_2 where useruuid=?')([useruuid], function(data) {
            logger.info(data);
                if (data.length) {
                    //!!!!! now oss use userid to send msg
                    user_name_map[data[0].id] = data[0].username;
                    callback(data[0].id);
                } else {
                    logger.info('uesrid and session not match');
                }
        },
        function() {
                logger.info('sql execute error');
        })
}

io.sockets.on('connection', function(socket) {
    // logger.info('socket connected');
        socket.on('register', function(params) {
        // logger.info(params);
                var address = socket.handshake.headers['x-real-ip'];
                useruuid = params[0]
                session = params[1]
                if (!useruuid || ! session) {
                        logger.info('invalid user or session', useruuid, session)
                        return
                }
                check_user_valid(useruuid, session, function(useruuid) {
                        if (useruuid in user_sockets) {
                                user_sockets[useruuid][socket.id] = socket;
                        } else {
                                user_sockets[useruuid] = {}
                                user_sockets[useruuid][socket.id] = socket;
                        }
                        socket.emit('confirmconnect');
                        socket_user_map[socket.id] = useruuid
                        logger.info('socket connected')
                        //logger.info(user_sockets)
                        logger.info(socket_user_map)
                })
        })
        socket.on('disconnect', function() {
                var address = socket.handshake.headers['x-real-ip'];
                logger.info('disconnect from ' + address)
                if (socket.id in socket_user_map) delete(user_sockets[socket_user_map[socket.id]][socket.id]);
                else {
                        logger.info('wtf is ' + socket.id)
                        logger.info(socket);
                }
                delete(socket_user_map[socket.id])
                logger.info('socket disconnect');
                //logger.info(user_sockets);
        })
        var a = null;
        socket.on('addfilter', function(data) {
                if (a === null) {
                        try {
                                a = net.connect({
                                        path: '/tmp/filter_sock'
                                },
                                function() {
                                        logger.info(data)
                                        data = JSON.stringify(data)
                                        a.write(data.length + ' ' + data)
                                });
                                //a.setNoDelay();
                        } catch(e) {
                                logger.info('can not connect to filter acceptor');
                                logger.error(e);
                        }
                } else {
                        logger.info(data)
                        data = JSON.stringify(data)
                        try {
                                a.write(data.length + ' ' + data)
                        } catch(e) {
                                logger.info('can not connect to filter acceptor');
                                logger.error(e);
                        }
                }

        })
})

