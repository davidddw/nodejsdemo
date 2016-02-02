// flow control conponent
var util = require('util');
var logger = require('./logger.js');
var emitter = require('events').EventEmitter;
var uuid = require('node-uuid');
var constr = require('./const.js');
var fs = require('fs');

var F = function(f){
    this.F = f;
};

F.prototype.fire = function(data, callback){
    if (this.F.constructor == Parallel || this.F.constructor == Serial){
        this.F.fire(data, callback);
    } else if (typeof(this.F) == 'function'){
        this.F(data, callback);
    }
};

F.prototype.constructor = F;

var Parallel = function(d){
    this.list = d;
    this.reject = new Reject();
};

Parallel.prototype.constructor = Parallel;

Parallel.prototype.parse = function(f){
    if (typeof(f) == 'object'){
        if (f.constructor == Array){
            return new Parallel(f);
        } else if (f.constructor == Serial || f.constructor == Parallel){
            return f;
        }
    } else if (typeof(f) == 'function'){
        return new F(f);
    } else{
        throw new Error('invalid parse type');
    }
};

Parallel.prototype.fire = function(init, handler){
    this.complete = 0;
    this.init = init;
    var datas = [];
    var p = this;
    var callback = function(index){
        return function(ans){
            p.complete ++;
            datas[index] = ans;
            if (p.complete == p.list.length){
                handler(datas);
            }
        }
    }
    var n = 0;
    if (this.list.length){
        this.list.forEach(function(a){setTimeout(function(){p.parse(a).fire(p.init, callback(n++))}, 0)})
    } else{
        handler(init);
    }
};

Parallel.prototype.fire_with_dict_data = function(init, handler){
    this.complete = 0;
    this.init = init;
    var datas = {};
    var p = this;
    var callback = function(index){
        return function(key, ans){
            p.complete ++;
            datas[key] = ans;
            if (p.complete == p.list.length){
                handler(datas);
            }
        }
    }
    var n = 0;
    if (this.list.length){
        this.list.forEach(function(a){setTimeout(function(){p.parse(a).fire(p.init, callback(n++))}, 0)})
    } else{
        handler(init);
    }
};

var Reject = function(){
    this.rejectObj = {
        endFlag: false,
    }
    this._data = {};
    this.setReject = function(errorMsg){
        this.rejectObj.endFlag = true;
    }
    this._refs = [];
    this.bindTo = function(target){
        if ('rejectHandler' in this.rejectObj){
            target.rejectObj.rejectHandler = this.rejectObj.rejectHandler;
            target.rejectObj.rejectFlag = this.rejectObj.rejectFlag;
        }
        this.rejectObj = target.rejectObj;
        for (var i in this._data){
            target._data[i] = this._data[i];
        }
        this._data = target._data;
        this._refs.forEach(function(i){
            i.bindTo(target);
            target._refs.push(i);
        });
        this._refs = [];
        target._refs.push(this);
    }
};

var Serial = function(f){
    this.list = f;
    this.reject = new Reject();
};

Serial.prototype.STD_END = function(std_breaker){
    //this.endFlag = true; this.std_breaker=std_breaker?std_breaker:function(){}
    this.reject.rejectObj.endFlag = true;
    this.reject.rejectObj.std_breaker = std_breaker ? std_breaker : function(){}
};
Serial.prototype.fire = function(data, callback, errorCallback){
    callback = callback ? callback : function(){};
    var p = this;
    if (p.list.length){
        this.reject.rejectObj.endFlag = false;
        var oricallback = callback;
        var next = function(data, callback){
            if (!p.reject.rejectObj.endFlag){
                if  (p.list.length){
                    p.parse(p.list.shift()).fire(data, next);
                } else{
                    oricallback(data);
                }
            } else{
                if ('std_breaker' in p.reject){
                    p.reject.rejectObj.std_breaker(data);
                }
                oricallback(data);
            }
        }
        next(data, callback);
    } else{
        callback(data);
    }
};

Serial.prototype.constructor = Serial;
Serial.prototype.parse = function(f){
    if (typeof(f) == 'object'){
        if (f.constructor == Array){
            return new Parallel(f);
        } else if (f.constructor == Serial || f.constructor == Parallel){
            return f;
        }
    } else if (typeof(f) == 'function'){
        return new F(f);
    } else{
        throw new Error('invalid parse type');
    }
};

var reverse = function(arr, recursive){
    var l = arr.length;
    var tmp;
    recursive = (recursive == -1) ? false : true;
    for (var i=0; i<=Math.floor((l-1)/2); i++){
        var f = arr[i];
        if (recursive && typeof(f) == 'object'){
            if (f.constructor == Array){
                reverse(arr);
            } else if (f.constructor == Serial || f.constructor == Parallel){
                reverse(f.list);
            }
        }
        if (i == l-1-i)
            break;
        f = arr[l-1-i];
        if (recursive && typeof(f) == 'object'){
            if (f.constructor == Array){
                reverse(arr);
            } else if (f.constructor == Serial || f.constructor == Parallel){
                reverse(f.list);
            }
        }
        tmp = arr[i];
        arr[i] = arr[l-1-i];
        arr[l-1-i] = tmp;
    }
};

var Qpack = function (f){
    this.steps = [];
    this._flow = new f(this.steps);
    this._creator = f;
    this._data = {};
    this._type = null;
    this._isAtom = null;
    this._fileds = null;
    this._sons = [];
};

Qpack.prototype = {
    //加入一个函数/Qpack(Serial)到主Qpack中，主Qpack必须是Serial的
    //当加入的子函数/Qpack中reject时，会退出主Qpack
    then: function(input){
        for (var i = 0; i<arguments.length; i++){
            input = arguments[i];
            this._sons.push(input)
            if (input.constructor  == Qpack){
                this.steps.push(input._flow);
                input._flow.reject.bindTo(this._flow.reject);
            } else if (typeof input == 'function'){
                if (input.length < 2){
                    this.steps.push(function(data, onFullfilled){
                        onFullfilled(input(data));
                    })
                } else {
                    this.steps.push(input);
                }
            }
        }
        return this;
    },
    pthen: function(input){
        var tmp_steps = [];
        this.step.push(tmp_steps);
        for (var i = 0; i<arguments.length; i++){
            input = arguments[i];
            this._sons.push(input)
            if (input.constructor  == Qpack){
                tmp_steps.push(input._flow);
                input._flow.reject.bindTo(this._flow.reject);
            } else if (typeof input == 'function'){
                if (input.length < 2){
                    tmp_steps.push(function(data, onFullfilled){
                        onFullfilled(input(data));
                    })
                } else {
                    tmp_steps.push(input);
                }
            }
        }
        return this;
    },
    //连接另一个Qpack到主Qpack中，但reject时不会break主Q, Q不和其他Q共享数据
    join: function(input){
        if (input.constructor != Qpack){
            throw new Error('Qpack can only joins a Qpack.');
        }
        this._sons.push(input);
        this.steps.push(input._flow);
        input._flow._joinFlag = true;
        return this;
    },
    resolve: function(a, callback, errorCallback){
        callback = callback ? callback : function(){};
        errorCallback = errorCallback ? errorCallback : function(){};
        this._flow.fire(a, callback, errorCallback)
    },
    run: function(input, a){this.then(input).resolve(a);return this},
    reject: function(errorMsg){
        this._flow.reject.setReject(errorMsg);
        if ('rejectHandler' in this._flow.reject.rejectObj){
            if (this.getData('_rollBack')){
                var p = this, args = arguments;
                this.getData('_rollBack').setRejectHandler(function(){
                    p._flow.reject.rejectObj.rejectHandler.apply(this.getData('_rollBack'), arguments);
                });
                this.getData('_rollBack').reverse(-1)
                .then(function(){
                    p._flow.reject.rejectObj.rejectHandler.apply(p, args);
                    if (p._flow.reject.rejectObj.rejectFlag){
                        p._flow.reject.rejectObj.rejectHandler = logger.info;
                    }
                }).
                resolve();
                this.setData('_rollBack', null);
            } else {
                this._flow.reject.rejectObj.rejectHandler.apply(this, arguments);
                if (this._flow.reject.rejectObj.rejectFlag){
                    this._flow.reject.rejectObj.rejectHandler = logger.info;
                }
            }
        } else {
            if (this.getData('_rollBack')){
                var p = this, args = arguments;
                this.getData('_rollBack').reverse(-1).resolve();
                this.setData('_rollBack', null);
            }
        }

    },
    constructor: Qpack,
    setRejectHandler: function(handler, onceFlag){
        this._flow.reject.rejectObj.rejectHandler = handler;
        this._flow.reject.rejectObj.rejectFlag = (onceFlag==false) ? false : true;
    },
    setRollBack: function(rollBack){
        if (!this.getData('_rollBack')){
            this.setData('_rollBack', new Qpack(Serial));
        }
        this.getData('_rollBack').then(rollBack);
    },
    setData: function(key, val){
        this._flow.reject._data[key] = val;
    },
    getData: function(key){
        return this._flow.reject._data[key];
    },
    reverse: function(recursive){
        reverse(this.steps, recursive);
        return this;
    },
    _dump: function(index, options){
        index = index ? '_'+index.toString() : '';
        if (!constr.APP_DEBUG_MODE)
            return;
        if (!options || typeof options != 'object' || Object.keys(options).length == 0){
            options = {tree: 1}
        }
        if (options.tree){
            var ans = JSON.stringify(getStructure(this));
        } else if (options.timeline){
            var ans = getTimeline(this).join('\n');
        }
        fs.open('debug/app_flow_structure'+index+'.json', 'w', function(err, fd){
            err ||  fs.write(fd, ans);
        });
    }
};

var getStructure = function(Q){
    var ans = {
        content: {
            data: Q._data,
            type: Q._type,
            fileds: Q._fileds,
        },
        sons: [],
        type: null,
        requestId: Q._requestId ? Q._requestId : null,
    }
    if (Q._creator == Parallel){
        ans.type = 'parallel';
        if (!Q._isAtom){
            Q._sons.forEach(function(son){
                ans.sons.push(getStructure(son));
            })
        }
    } else if (Q._creator == Serial){
        ans.type = 'serial';
        if (!Q._isAtom){
            var cur = ans;
            Q._sons.forEach(function(son){
                var res = getStructure(son);
                cur.sons.push(res);
                cur = res;
            })
        }
    } else if (typeof Q == 'function'){
        ans.type = 'function';
    }
    return ans;
};

var getTimeline = function(Q, ans){
    ans = ans ? ans : [];
    if (Q._requestId){
        Q._fileds = Q._fileds ? Q._fileds : '';
        ans.push(Q._requestId+' '+JSON.stringify(Q._fileds));
    }
    Q._sons && Q._sons.forEach(function(son){
        getTimeline(son, ans);
    })
    return ans;
};

/*test*/
/*
var a = new Qpack(Serial);
var b = new Qpack(Serial);
b.then(function(){
    b.reject(200)
    return 200
})
a.join(b)
.then(function(c){console.log('b=',c)})
.resolve('');
console.log(a)
var a = new Qpack(Serial);
a.setRejectHandler(console.log);
a.setRollBack(function(a,f){setTimeout(function(){console.log('a'); f()}, 1000)});
var b = new Qpack(Serial);
var c = new Qpack(Serial);
c.setRejectHandler = console.log;
c.then(function(a,f){setTimeout(function(){console.log('b'); c.reject(100);f()}, 1000)})
b.then(function(a){
    b.setRollBack(c);
    b.reject(200)
    return 200;
})
a.then(b).then(function(a){console.log(a); return a+1}).resolve();
var a = new Qpack(Serial);
a.then(function(a, f){
    console.log('a1');
    setTimeout(f, 1000)
})
.then(function(a, f){
    console.log('a2');
    setTimeout(f, 1000)
})
var b = new Qpack(Parallel);
b.then(function(a, f){
    console.log('b1');
    setTimeout(f, 1000)
})
.then(function(a, f){
    console.log('b2');
    setTimeout(f, 1000)
})
var c = new Qpack(Serial);
c.then(function(a, f){
    console.log('c1');
    setTimeout(f, 1000)
})
.then(function(a, f){
    console.log('c2');
    setTimeout(f, 1000)
})
var d = new Qpack(Serial);
d.then(function(a, f){
    console.log('d1');
    setTimeout(f, 1000)
})
.then(function(a, f){
    console.log('d2');
    setTimeout(f, 1000)
})
b.then(d);
a.then(b).then(c).reverse(-1).resolve();
*/
/*
var a = new Qpack(Serial);
a.then(function(){
    console.log(1);
    return 1;
})
.then(function(data, f){
    setTimeout(function(){f(data)}, 1000);
})
.then(function(data){
    return data+1;
})
.then(function(ans){
    console.log(ans)
})
.resolve()
a.then(function(data, onFullfilled){setTimeout(function(){onFullfilled(data)}, 1000)})
.then(function(data, onFullfilled){setTimeout(function(){data+=1; console.log(data); onFullfilled(data)}, 1000)})
.then(function(data, onFullfilled){setTimeout(function(){data+=1; console.log(data); onFullfilled(data)}, 1000)})
var b = new Qpack(Parallel);
b.then(function(data, onFullfilled){setTimeout(function(){
    b.then(function(data, onFullfilled){
        console.log('afsd', b._flow.reject);
        setTimeout(function(){console.log(data+'xxx');  b.reject(); onFullfilled(22)}, 5000)
    })
    .then(function(data, onFullfilled){
        setTimeout(function(){console.log(data+'xx'); onFullfilled(16)}, 2000)
    })
}, 1000)
onFullfilled(1);})
var c = new Qpack(Serial);
c.then(function(data, onFullfilled){setTimeout(function(){console.log(data), onFullfilled(data)}, 1000)})
.then(function(data, onFullfilled){setTimeout(function(){data+=1; console.log(data); onFullfilled(data)}, 1000)})
.then(function(data, onFullfilled){setTimeout(function(){data+=1; console.log(data); onFullfilled(data)}, 1000)})
a.then(b).then(c).resolve(1, console.log, console.log);
*/
/*
var f = function(n, f){setTimeout(function(){console.log(n); f(n)}, 1000)};
var p = function(n, f){setTimeout(function(){console.log(n); f(n)}, 2000)};
var a = new Parallel([f(1), [f(2) , [f(3), f(5), f(6)]], f(4)]);
a.fire(console.log);
var a = new Parallel([f1, f2, f3]);
a.fire_with_dict_data('a', function(a){console.log(a)});
var f1 = function(n, f){setTimeout(function(){console.log(n); f('a', n)}, 1000)};
var f2 = function(n, f){setTimeout(function(){console.log(n); f('b', n)}, 2000)};
var f3 = function(n, f){setTimeout(function(){console.log(n); f('c', n)}, 3000)};
var b = new Serial([f, [f, f], f]);
var c = new Serial([f, [f, new Serial([f, f])]]);
c.fire(1, function(d){console.log('ans is ', d)});
b.fire(1, function(d){console.log('ans is ', d)});
var c = new Serial([f, [f, new Serial([f, f])]]);
c.fire(2, function(d){console.log('ans is ', d)});
*/
module.exports = {serial: Serial, parallel: Parallel, Qpack: Qpack};
