// call remote server api

var util = require('util');
var logger = require('./logger.js');
var flow = require('./flow.js');
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var constr = require('./const.js');
var uuid = require('node-uuid');
//https disable ssl reject
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var _callfunc = function(method, options){
    return function(url, data, callback, errorcallback){
        var requestid = uuid.v4();
        if (url.charAt(0) !== '/') {
            url = '/' + url;
        }
        if (url.charAt(url.length-1) != '/') {
            url += '/';
        }
        var user_session,cookie;
        var req_data = {};
        if(typeof(data) == 'object' && 'session' in data){
            user_session = data.session;
        }else{
            user_session = '';
        }
        if (method == 'get' || method=='delete'){
            var urlparam = querystring.stringify(data);
            if (urlparam.length)
                url += '?'+ urlparam
            data = '';
        }
        if('prefix' in options){
            url = '/' + options.prefix + url;
        }
        if (typeof(url) == 'undefined')
            throw new Error('url of api is required');
        if (typeof(data) == 'undefined')
           data = '';
        if (method =='post' && 'web' in options && options.web){
            var contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
            data = querystring.stringify(data);
            var payload_data = data;
        } else {
            var contentType = 'application/json; charset=UTF-8';
            var payload_data = JSON.stringify(data);
        }

        req_data = {
                host : options.ip,
                port : options.port,
                path : url,
                method : method,
                rejectUnauthorized : false,
                headers : {
                    'content-type' : contentType,
                    'content-length' : (new Buffer(payload_data, 'utf-8')).length,
                    'connection' : 'keep-alive',
                    'X-FROM': 'appserver',
                }
            };
        if ('ssl' in options && options['ssl']){
            protocol = https;
            cookie = 'PHPSESSID=' + user_session;
            req_data.headers.cookie = cookie;
            logger.info('call  '+requestid, method.toUpperCase(),
                'https://'+options.ip+':'+options.port+url, 'with ', data, options);
        } else{
            protocol = http;
            logger.info('call  '+requestid, method.toUpperCase(),
                'http://'+options.ip+':'+options.port+url, 'with ', data, options);
        }
        var p = protocol.request(
            req_data,
            function(res){
                var data = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk){
                    data += chunk;
                });
                res.on('end', function(){
                    logger.info('api '+requestid+' res status code', res.statusCode, '>', data);
                    if (res.statusCode != 200){
                        var newdata;
                        try {
                            newdata = JSON.parse(data);
                        } catch(e){
                            newdata = data;
                            logger.debug("data is not json");
                        }
                        errorcallback(res.statusCode, newdata);
                        return;
                    }
                    callback = callback ? callback : logger.debug;
                    /*
                    if (d = JSON.parse(d)){
                        if (d.OPT_STATUS == 'SUCCESS'){
                            if (d.DATA.constructor == Array){
                                ans = {OPT_STATUS:'SUCCESS', DATA:{lcuuid:d.DATA[0].LCUUID}};
                                if ('LCID' in d.DATA[0]){
                                    ans.DATA.id = d.DATA[0].LCID
                                }
                            } else{
                                ans = {OPT_STATUS:'SUCCESS', DATA:{lcuuid:d.DATA.LCUUID}};
                                if ('LCID' in d.DATA){
                                    ans.DATA.id = d.DATA.LCID;
                                }
                            }
                        } else{
                            ans = {OPT_STATUS:'FAILED'};
                        }
                    }
                    */
                    callback(res.statusCode, JSON.parse(data));
                });
            }
        );
        p.on('error', function(e){
            if (typeof(errorcallback) == 'undefined'){
                logger.error('api request error : '+e.message);
            } else{
                errorcallback(e);
            }
        });
        p.write(payload_data);
        p.end();
        return requestid;
    }
};

var gen_api = function(options) {
    return {
        _callfunc : function(method){return _callfunc(method, options);},
        get : _callfunc('get', options),
        post : _callfunc('post', options),
        patch : _callfunc('patch', options),
        put : _callfunc('put', options),
        del : _callfunc('delete', options),
    }
}

var api = gen_api({ip:'127.0.0.1', port:'20013'});
var backup_api = gen_api({ip:'127.0.0.1', port:'20019'});
//var web_api = gen_api({ip:'127.0.0.1', port:'80', web:true});
//var web_api = gen_api({ip:'10.66.45.2',port:'443',web:true,ssl:true});
var cashier_api = gen_api({ip:'127.0.0.1', port:'20017'});

var storage_api = gen_api({ip:'127.0.0.1', port:'20102'});
var azure_api = gen_api({ip:'127.0.0.1', port:'20104'});
var callStorage = function(method, url, data, dataParse){
    method = method.toLowerCase();
    dataParse = dataParse ? dataParse : function(a){return a;};
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        data = data ? data : placeHolder;
        storage_api[method](url, data,
            function(sCode, body){
                onFullfilled(dataParse({'code': sCode, 'body': body}));
            },
            function(sCode, body){Q.reject(sCode, body); onFullfilled({code:sCode, body: body})}
        )
    })
}
var callVMSnapshot = function(method, url, data, dataParse){
    method = method.toLowerCase();
    dataParse = dataParse ? dataParse : function(a){return a;};
    var Q = new flow.Qpack(flow.serial);
    Q.then(function(placeHolder, onFullfilled){
        data = data ? data : placeHolder;
        api[method](url, data,
            function(sCode, body){
                onFullfilled(dataParse({'code': sCode, 'body': body}));
            },
            function(sCode, body){Q.reject(sCode, body); onFullfilled({code:sCode, body: body})}
        )
    })
    return Q;
}
var callCharge = function (method, url, data, dataParse){
    var Q = new flow.Qpack(flow.serial);
    var web_api = gen_api({ip:constr.getBss(), port:443, web:false, ssl:true, prefix:"chargemod"});
    dataParse = dataParse ? dataParse : function(a){return a;};
    return Q.then(function(placeHolder, onFullfilled){
        var condition = 'select ip from ?? where role=1';
        data = data ? data : placeHolder;
        web_api._callfunc(method)(url, data,
            function(sCode, body){
                onFullfilled(dataParse({'code': sCode, 'body': body}));
            },
            function(sCode, body){Q.reject(sCode, body); onFullfilled({code:sCode, body: body})}
        );
    })
};
var scallTalker = function(method, url, data, dataParse){
    method = method.toLowerCase();
    dataParse = dataParse ? dataParse : function(a){return a;};
    var Q = new flow.Qpack(flow.serial);
    Q._type = 'API';
    Q._fileds = {
        'method': method,
        'url': url,
        'data': data,
    }
    Q._isAtom = true;
    Q.then(function(placeHolder, onFullfilled){
        data = data ? data : placeHolder;
        Q._requestId = api[method](url, data,
            function(sCode, body){
                onFullfilled(dataParse(body.DATA));
            },
            function(sCode, body){Q.reject(sCode, body); onFullfilled({code:sCode, body: body})}
        );
    })
    return Q;
};
var rawCallTalker = function(method, url, data, dataParse){
    method = method.toLowerCase();
    dataParse = dataParse ? dataParse : function(a){return a;};
    var Q = new flow.Qpack(flow.serial);
    Q._type = 'API';
    Q._fileds = {
        'method': method,
        'url': url,
        'data': data,
    };
    Q._isAtom = true;
    Q.then(function(placeHolder, onFullfilled){
        data = data ? data : placeHolder;
        Q._requestId = api[method](url, data,
            function(sCode, body){
                onFullfilled(dataParse({code: sCode, body: body}));
            },
            function(sCode, body){
                onFullfilled(dataParse({code: sCode, body: body}));
            }
        );
    });
    return Q;
};

/*test*/
//api.get('/test/testsession');
//api.put('/test/testsession');
//api.del('/test/testsession');
//web_api.post('/test/test', {a:'a'}, console.log, console.log);

module.exports = {
    api: api,
//    web_api: web_api,
    cashier_api: cashier_api,
    gen_api: gen_api,
    backup_api:backup_api,
    azure_api:azure_api,
    callStorage: callStorage,
    callVMSnapshot: callVMSnapshot,
    callCharge: callCharge,
    callTalker: callVMSnapshot,
    scallTalker: scallTalker,
    rawCallTalker: rawCallTalker,
};
