var validator = require('validator');
var lc_utils = require('./lc_utils.js');
var util = require('util');

/*
 *  lcValidator for dict/array params check
 *  optional key starts with @
 *  array has only one formatter, all values in array will apply with the formatter
 *  if first argument is array, there is an optional second argument specify the required length of
 *  the array
 * */
var lcValidator = function(){
    this._strictMode = false;
    if (arguments.length > 2 || arguments.length == 0)  {
        throw new Error('lcValidator require 1 or 2 arguments');
    }
    if (arguments[0].constructor == Array){
        this._isArray = true;
        this.constructor = Array;
        this._length = arguments[1];
        if (arguments[0].length != 1){
            throw new Error('lcValidator array formatter can only accept a lenth-1 array.'
                        + 'use object formatter for multi params check')
        }
    } else if (arguments.length == 2){
        throw new Error('lcValidator has no second argument for object or function formatter');
    } else if (typeof arguments[0] == 'object'){
        this._isObject = true;
    } else {
        throw new Error('lcValidator require first validator to be array or object');
    }
    this.formatter = arguments[0];

    if (this._isObject){
        for (var i in this.formatter){
            if (! 'format' in this.formatter[i]){
                throw new Error('formatter ' + i + ' has no \'format\' method');
            }
        }
    }
    if (this._isArray){
        if (!'format' in this.formatter[0]){
            throw new Error('formatter ' + i + ' has no \'format\' method');
        }
    }
    this.errors = {};
    this.getError = function(){
        for (var i in this.errors){
            return true;
        }
        return false;
    }

}

lcValidator.prototype = {
    format: function(params){
        this.errors = {};
        if (this._isObject){
            if (typeof params != 'object'){
                this.errors = {1: JSON.stringify(params) + ' is not an object'};
                return false
            }
            var body = {}
            var optional = false;
            for (var i in this.formatter){
                optional = false;
                if (i.charAt(0) === '@'){
                    optional = true;
                    var paramKey = i.substr(1);
                } else {
                    var paramKey = i;
                }
                if (paramKey in params){
                    var currentFormatter = this.formatter[i];
                    body[paramKey] = currentFormatter.format(params[paramKey]);
                    if (currentFormatter.getError()){
                        this.errors[paramKey] = currentFormatter.errors;
                        return false;
                    }
                    delete(params[paramKey]);
                } else if (!optional) {
                    this.errors[paramKey] = paramKey + ' is required in ' + JSON.stringify(params);
                    return false;
                }
            }
            if (this._strictMode){
                for (var i in params){
                    this.errors[i] = 'extra params';
                }
                for (var j in this.errors){
                    return false;
                }
            }
            lc_utils.replaceObject(params, body);
            return body;
        }

        if (this._isArray){
            var body = [];
            if (params.constructor != Array){
                this.errors = {1: JSON.stringify(params) + ' is not an array'};
                return false
            }
            var p = this;
            if (this._length && this._length != params.length){
                p.errors[JSON.stringify(params)] = 'array length does not match: required length is '
                + this._length;
                return false;
            }
            var currentFormatter = this.formatter[0];
            params.forEach(function(i){
                body.push(currentFormatter.format(i));
                if (currentFormatter.getError()){
                    p.errors[i] = currentFormatter.errors;
                    return false
                }
            })
            lc_utils.replaceObject(params, body);
            return body;

        }
    },
}

/*
 * basicValidator for function check or basic equal
 */
var basicValidator = function(formatter, name){
    this.formatter = formatter;
    this.errors = {};
    this.args = [];
    for (var i=0; i<arguments.length; i++){
        this.args.push(arguments);
    }
    this.args.shift();
    this.getError = function(){
        for (var i in this.errors){
            return true;
        }
        return false;
    }
    if (typeof this.formatter == 'function'){
        if (!name){
            throw new Error('basicValidator require a name description for function formatter');
        }
        this._isFunction = true;
        this.checkName = name;
        this.args.shift();
    }
}

basicValidator.prototype = {
    format: function(testVar){
        this.errors = {};
        if (this._isFunction){
            if (this.formatter.apply(this, [testVar])){
                return testVar;
            }
            this.errors[testVar] = this.checkName + ' test failed';
            return false;
        } else {
            if (testVar != this.formatter){
                this.errors[testVar] = testVar + 'does not equals ' + JSON.stringify(this.formatter);
                return false;
            }
            return testVar;
        }
    }
}

/*
 * inValidator for enum
 */
var inValidator = function(values){
    if (values.constructor != Array){
        throw new Error('inValidator require values to be an array');
        return;
    }
    this.values = values;
    this.errors = {};
    this.getError = function(){
        for (var i in this.errors){
            return true;
        }
        return false;
    }
}
inValidator.prototype = {
    format: function(a){
        this.errors = {};
        if (this.values.indexOf(a) != -1){
            return a;
        } else {
            this.errors[a] = JSON.stringify(a) + ' is not in ' + JSON.stringify(this.values);
            return false
        }
    }
}

/*
try {
    //test
    //lcValidator should return a validator
    var validator1 = new basicValidator(validator.contains, 'a');
    var validator2 = new lcValidator({'a': validator1});
    var validator3 = new lcValidator({'c': validator2});
    var validator4 = new inValidator(['a', 'b', 'c']);
    var validator6 = new lcValidator([validator1], 3)
    var validator5 = new lcValidator({'@a': validator1, 'b': validator6, 'c': validator3,
        'd':validator4})
    console.log(validator1.format('a'));
    if (validator1.getError())
        console.log(validator1.errors);


    console.log(validator2.format({'a': 'b'}));
    if (validator2.getError())
        console.log(validator2.errors);


    console.log(validator3.format({'c': 'a'}));
    if (validator3.getError())
        console.log(validator3.errors);

    console.log(validator4.format('b'))
    if (validator4.getError())
        console.log(validator4.errors);

    console.log(validator5.format({'e':1, 'b': ['abc', 'abc', 'abc'], 'c': {'c': {'a' :'dav'} }, 'd': 'n'}));
    if (validator5.getError())
        console.log(util.inspect(validator5.errors, {depth:null}));

    validator5._strictMode = true;
    console.log(validator5.format({'e':1, 'b': {'a':23}, 'c': {'c': {'a' :3} }, 'd': 'c'}));
    if (validator5.getError())
        console.log(validator5.errors);

    console.log(validator6.format([1, 2, 3]));
    if (validator6.getError())
        console.log(validator6.errors);

} catch (e){
    console.log(e.stack);
}

*/

module.exports = {
    lcValidator: lcValidator,
    basicValidator: basicValidator,
    inValidator: inValidator,
}
