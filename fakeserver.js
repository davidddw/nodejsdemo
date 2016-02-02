var restify = require('restify');
var net = require('net');
var util = require('util');


var server = restify.createServer({
    name : 'fakeserver',
    /*
    formatters : {
        'application/json' : function(req, res, body){
            if (body instanceof Error){
                console.error(body);
                return body.stack;
            } else if (Buffer.isBuffer(body)){
                return body.toString('base64');
            } else{
                return util.inspect(body);
            }
        }
    }
    */
});
//server.use(auth_checker);
//server.use(url_parser_instance);
server.use(restify.queryParser())
server.use(restify.bodyParser())
server.post('/v1/vms/', function(req, res, next){
    var data = req.body.DATA;
    console.log(data);
    for (var i=0; i<data.length; i++){
        data[i].LCUUID = parseInt(Math.random()*1000000);
    }
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();
    for (var i=0; i<data.length; i++){
        data[i].STATE = 2;
        var ans = {'DATA':data[i], 'TYPE':'vm', OPT_STATUS:'SUCCESS'};
        setTimeout(function(){var a=net.connect({path : '/tmp/node-connection-sock'}, function(){
            a.write(JSON.stringify(ans));
        });}, 3000);
    }
});
server.patch('/v1/vms/:id', function(req, res, next){
    var data = req.body;
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();
    var ans = {'DATA':data, 'TYPE':'vm', OPT_STATUS:'SUCCESS'};
    setTimeout(function(){var a=net.connect({path : '/tmp/node-connection-sock'}, function(){
        a.write(JSON.stringify(ans));
    });}, 3000);
});
server.patch('/v1/vgws/:id', function(req, res, next){
    var data = req.body;
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();
    var ans = {'DATA':data, 'TYPE':'vgw', OPT_STATUS:'SUCCESS'};
    setTimeout(function(){var a=net.connect({path : '/tmp/node-connection-sock'}, function(){
        a.write(JSON.stringify(ans));
    });}, 3000);
});



server.post('/v1/vl2s/', function(req, res, next){
    var data = req.body;
    data.LCUUID = parseInt(Math.random()*1000000);
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();
    data.STATE = 4;
    var ans = {'DATA':data, 'TYPE':'vl2', OPT_STATUS:'SUCCESS'};
    setTimeout(function(){var a=net.connect({path : '/tmp/node-connection-sock'}, function(){
        a.write(JSON.stringify(ans));
    });}, 3000);


});
server.post('/v1/vgws/', function(req, res, next){
    var data = req.body.DATA;
    data.LCUUID = parseInt(Math.random()*1000000);
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();
    data.STATE = 4;
    var ans = {'DATA':data, 'TYPE':'vgw', OPT_STATUS:'SUCCESS'};
    setTimeout(function(){var a=net.connect({path : '/tmp/node-connection-sock'}, function(){
        a.write(JSON.stringify(ans));
    });}, 3000);


});
server.post('/v1/vdcs/', function(req, res, next){
    var data = req.body.DATA;
    data.LCUUID = parseInt(Math.random()*1000000);
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();

});



server.post('/v1/vdcs/', function(req, res, next){
    var data = req.body;
    for (var i=0; i<data.length; i++){
        data[i].LCUUID = parseInt(Math.random()*1000000);
    }
    ans = {'DATA':data, 'OPT_STATUS':'SUCCESS'};
    //res.setHeader('content-type', 'application/json');
    res.send(ans);
    console.log('data is ', ans);
    next();
    /*
    for (var i=0; i<data.length; i++){
        data[i].STATE = 4;
        var ans = {'DATA':data[i], 'TYPE':'vdc', OPT_STATUS:'SUCCESS'};
        setTimeout(function(){var a=net.connect({path : '/tmp/node-connection-sock'}, function(){
            a.write(JSON.stringify(ans));
        });}, 3000);
    }
    */


});


server.listen(8085, function(){console.log('%s listening at %s', server.name, server.url)});


