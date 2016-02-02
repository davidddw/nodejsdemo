var Obj = require('./obj.js');
var logger = require('./logger.js');
var util = require('util');
var Cashier = require('./cashier.js');
var flow = require('./flow.js');
var lc_utils = require('./lc_utils.js');
var constr = require('./const.js');

var Balance = function() {Obj.call(this);}

util.inherits(Balance, Obj);

Balance.prototype.type = 'balance';

Balance.prototype.tableName = 'fdb_user_v2_2';
Balance.prototype.product_spec_tableName = 'product_specification_v2_2';

Balance.prototype.checkBalance = function(out_app, data, callback, errorcallback) {
    var i, j;
    var p = this;
    var balance = '';
    var price = 0,ips_price = 0,bw_price = 0,vgw_price = 0,vm_price = 0,lb_price = 0,scanners_price = 0,nas_price = 0,vmsnapshot_price = 0;

    var flow_steps = [];
    var app = new flow.serial(flow_steps);

    var balance = '';

    flow_steps.push(function(a, f) {
        p.selectSql([Balance.prototype.tableName, 'id', data.USERID],function(ans){
            if (ans.length > 0){
                balance = parseFloat(ans[0].balance);
                logger.info("user "+data.USERID+" balance is "+balance);
                if(balance <=0){
                    callback(false);
                    app.STD_END();
                }
            }
            f(a);
        },function(){
            errorcallback(500, {OPT_STATUS:constr.OPT.DB_QUERY_ERROR, DESCRIPTION:"db query error"});
            out_app.STD_END();
        })
    })

    if('IPS' in data){
        var ips_map = new Map();
        for (i = 0; i < data.IPS.length; ++i) {
            var inter_price = 0;
            var ip = data.IPS[i];
            if(!lc_utils.checkInstanceNum({type:'IPS',num:ip.IP_NUM})){
                callback(false);
                app.STD_END();
            }
            (function(ip){
                flow_steps.push(function(a, f) {
                    if(!ips_map.get(ip.PRODUCT_SPECIFICATION_LCUUID)){
                        var cashierCallback = function(rdata){
                            var filter = {};
                            if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                                inter_price = parseFloat(rdata.DATA.PRICE);
                                var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                                if(charge_mode == 1){
                                    inter_price = inter_price * 60 * 60 ;
                                }else if(charge_mode == 2){
                                    inter_price = inter_price * 60 ;
                                }else if(charge_mode == 4){
                                    inter_price = inter_price / 24 ;
                                }
                                if(!ips_map.get(ip.PRODUCT_SPECIFICATION_LCUUID)){
                                    ips_map.put(ip.PRODUCT_SPECIFICATION_LCUUID,inter_price);
                                }
                                f(a);
                            }else{
                                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                                app.STD_END();
                            }
                        }
                        var cas = new Cashier();
                        var charge_data = {};
                        charge_data.PRODUCT_TYPE = "ip";
                        charge_data.product_specification_lcuuid = ip.PRODUCT_SPECIFICATION_LCUUID;
                        charge_data.DOMAIN = ip.DOMAIN;
                        cas.get_charge_info(charge_data,cashierCallback);
                    }else{
                        inter_price = ips_map.get(ip.PRODUCT_SPECIFICATION_LCUUID);
                        f(a);
                    }
                });
            })(ip)
            flow_steps.push(function(a, f) {
                for(j = 0; j < ip.IP_NUM; ++j){
                    ips_price += inter_price;
                }
                f(a);
            })
        }
    }

    if('BANDWIDTHS' in data){
        var bw_map = new Map();
        for (i = 0; i < data.BANDWIDTHS.length; ++i) {
            var bw = data.BANDWIDTHS[i];
            (function(bw){
                flow_steps.push(function(a, f) {
                    var inter_price = 0;
                    if(!lc_utils.checkInstanceNum({type:'BANDWIDTHS',num:bw.BANDWIDTH / 1024 / 1024})){
                        callback(false);
                        app.STD_END();
                    }
                    if(!bw_map.get(bw.PRODUCT_SPECIFICATION_LCUUID)){
                        var cashierCallback = function(rdata){
                            if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                                inter_price = parseFloat(rdata.DATA.PRICE);
                                var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                                if(charge_mode == 1){
                                    inter_price = inter_price * 60 * 60 ;
                                }else if(charge_mode == 2){
                                    inter_price = inter_price * 60 ;
                                }else if(charge_mode == 4){
                                    inter_price = inter_price / 24 ;
                                }
                                bw_price += inter_price;
                                if(!bw_map.get(bw.PRODUCT_SPECIFICATION_LCUUID)){
                                    bw_map.put(bw.PRODUCT_SPECIFICATION_LCUUID,inter_price);
                                }
                                f(a);
                            }else{
                                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                                app.STD_END();
                            }
                        }
                        var cas = new Cashier();
                        var charge_data = {};
                        charge_data.PRODUCT_TYPE = "bandw";
                        charge_data.product_specification_lcuuid = bw.PRODUCT_SPECIFICATION_LCUUID;
                        charge_data.DOMAIN = bw.DOMAIN;
                        charge_data.BW = bw.BANDWIDTH / 1024 / 1024;
                        cas.get_charge_info(charge_data,cashierCallback);
                    }else{
                        inter_price = bw_map.get(bw.PRODUCT_SPECIFICATION_LCUUID);
                        bw_price += inter_price;
                        f(a);
                    }
                });
            })(bw)
       }
    }

    if('VGWS' in data){
        if(!lc_utils.checkInstanceNum({type:'VGWS',num:data.VGWS.length},errorcallback)){
            callback(false);
            app.STD_END();
        }
        var vgw_map = new Map();
        for (i = 0; i < data.VGWS.length; ++i) {
            var vgateway = data.VGWS[i];
            var inter_price = 0 ;
            (function(vgateway){
                flow_steps.push(function(a, f) {
                    if(!vgw_map.get(vgateway.PRODUCT_SPECIFICATION_LCUUID)){
                        var cashierCallback = function(rdata){
                            var filter = {};
                            if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                                inter_price = parseFloat(rdata.DATA.PRICE);
                                var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                                if(charge_mode == 1){
                                    inter_price = inter_price * 60 * 60 ;
                                }else if(charge_mode == 2){
                                    inter_price = inter_price * 60 ;
                                }else if(charge_mode == 4){
                                    inter_price = inter_price / 24 ;
                                }
                                vgw_price += inter_price;
                                if(!vgw_map.get(vgateway.PRODUCT_SPECIFICATION_LCUUID)){
                                    vgw_map.put(vgateway.PRODUCT_SPECIFICATION_LCUUID,inter_price);
                                }
                                f(a);
                            }else{
                                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                                app.STD_END();
                            }
                        }
                        var cas = new Cashier();
                        var charge_data = {};
                        charge_data.PRODUCT_TYPE = "vgateway";
                        charge_data.product_specification_lcuuid = vgateway.PRODUCT_SPECIFICATION_LCUUID;
                        charge_data.DOMAIN = vgateway.DOMAIN;
                        cas.get_charge_info(charge_data,cashierCallback);
                    }else{
                        inter_price = vgw_map.get(vgateway.PRODUCT_SPECIFICATION_LCUUID);
                        vgw_price += inter_price;
                        f(a);
                    }
                });
            })(vgateway)
        }
    }

    if('VMS' in data){
        if(!lc_utils.checkInstanceNum({type:'VMS',num:data.VMS.length},errorcallback)){
            callback(false);
            app.STD_END();
        }
        for (i = 0; i < data.VMS.length; ++i) {
            var vm = data.VMS[i];
            var inter_price = 0;
            (function(vm){
                flow_steps.push(function(a, f) {
                    var cashierCallback = function(rdata){
                        var filter = {};
                        if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                            inter_price = parseFloat(rdata.DATA.PRICE);
                            var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                            if(charge_mode == 1){
                                inter_price = inter_price * 60 * 60 ;
                            }else if(charge_mode == 2){
                                inter_price = inter_price * 60 ;
                            }else if(charge_mode == 4){
                                inter_price = inter_price / 24 ;
                            }
                            vm_price += inter_price;
                            f(a);
                        }else{
                            errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                            app.STD_END();
                        }
                    }
                    var cas = new Cashier();
                    var vm_charge_data = {};
                    vm_charge_data.CPU = vm.VCPU_NUM;
                    vm_charge_data.MEMORY = vm.MEM_SIZE;
                    vm_charge_data.DISK =  vm.USER_DISK_SIZE;
                    vm_charge_data.DOMAIN =  vm.DOMAIN;
                    vm_charge_data.PRODUCT_TYPE = 'vm';
                    cas.get_charge_info(vm_charge_data,cashierCallback);
                });
            })(vm)
        }
    }

    if('LBS' in data){
        if(!lc_utils.checkInstanceNum({type:'LBS',num:data.LBS.length},errorcallback)){
            callback(false);
            app.STD_END();
        }
        var lb_map = new Map();
        for (i = 0; i < data.LBS.length; i++) {
            var lb = data.LBS[i];
            var inter_price = 0;
            (function(lb){
                flow_steps.push(function(a, f) {
                    if(!lb_map.get(lb.PRODUCT_SPECIFICATION_LCUUID)){
                        p.selectSql([p.product_spec_tableName, 'lcuuid', lb.PRODUCT_SPECIFICATION_LCUUID],function(psans) {
                            if (psans.length > 0){
                                var content,compute_size;
                                if('content' in psans[0]){
                                    content = JSON.parse(psans[0].content);
                                    if('compute_size' in content){
                                        compute_size = JSON.parse(JSON.stringify(content.compute_size));  
                                    }else{
                                        errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get lb compute_size price is not specified'});
                                        app.STD_END();
                                    }
                                }else{
                                    errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get lb compute_size content is not specified'});
                                    app.STD_END();
                                }
                                var cashierCallback = function(rdata){
                                    var filter = {};
                                    if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                                        inter_price = parseFloat(rdata.DATA.PRICE);
                                        var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                                        if(charge_mode == 1){
                                            inter_price = inter_price * 60 * 60 ;
                                        }else if(charge_mode == 2){
                                            inter_price = inter_price * 60 ;
                                        }else if(charge_mode == 4){
                                            inter_price = inter_price / 24 ;
                                        }
                                        lb_price += inter_price;
                                        if(!lb_map.get(lb.PRODUCT_SPECIFICATION_LCUUID)){
                                            lb_map.put(lb.PRODUCT_SPECIFICATION_LCUUID,inter_price);
                                        }
                                        f(a);
                                    }else{
                                        errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                                        app.STD_END();
                                    }
                                }
                                var cas = new Cashier();
                                var lb_charge_data = {};
                                lb_charge_data.CPU = compute_size.vcpu_num;
                                lb_charge_data.MEMORY = compute_size.mem_size;
                                lb_charge_data.DISK =  compute_size.sys_disk_size;
                                lb_charge_data.product_specification_lcuuid = lb.PRODUCT_SPECIFICATION_LCUUID;
                                lb_charge_data.DOMAIN =  lb.DOMAIN;
                                lb_charge_data.PRODUCT_TYPE = 'lb';
                                cas.get_charge_info(lb_charge_data,cashierCallback);
                            } else{
                                errorcallback(404);
                            }
                        },errorcallback);
                    }else{
                        inter_price = lb_map.get(lb.PRODUCT_SPECIFICATION_LCUUID);
                        lb_price += inter_price;
                        f(a);
                    }
                });
            })(lb)
        }
    }

    if('SCANNERS' in data){
        var scanners_map = new Map();
        for (i = 0; i < data.SCANNERS.length; ++i) {
            var scanners_data = data.SCANNERS[i];
            var inter_price = 0 ;
            (function(scanners_data){
                flow_steps.push(function(a, f) {
                    if(!scanners_map.get(scanners_data.PRODUCT_SPECIFICATION_LCUUID)){
                        var cashierCallback = function(rdata){
                            var filter = {};
                            if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                                inter_price = parseFloat(rdata.DATA.PRICE);
                                scanners_price += inter_price;
                                f(a);
                            }else{
                                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                                app.STD_END();
                            }
                        }
                        var cas = new Cashier();
                        var charge_data = {};
                        charge_data.PRODUCT_TYPE = "other";
                        charge_data.product_specification_lcuuid = scanners_data.PRODUCT_SPECIFICATION_LCUUID;
                        charge_data.DOMAIN = scanners_data.DOMAIN;
                        cas.get_charge_info(charge_data,cashierCallback);
                    }else{
                        inter_price = nas_map.get(scanners_data.PRODUCT_SPECIFICATION_LCUUID);
                        scanners_price += inter_price;
                        f(a);
                    }
                });
            })(scanners_data)
        }
    }

    if('NAS' in data){
        var nas_map = new Map();
        for (i = 0; i < data.NAS.length; ++i) {
            var nas_data = data.NAS[i];
            var inter_price = 0 ;
            (function(nas_data){
                flow_steps.push(function(a, f) {
                    if(!nas_map.get(nas_data.PRODUCT_SPECIFICATION_LCUUID)){
                        var cashierCallback = function(rdata){
                            var filter = {};
                            if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                                inter_price = parseFloat(rdata.DATA.PRICE) * parseFloat(nas_data.TOTAL_SIZE);
                                var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                                if(charge_mode == 1){
                                    inter_price = inter_price * 60 * 60 ;
                                }else if(charge_mode == 2){
                                    inter_price = inter_price * 60 ;
                                }else if(charge_mode == 4){
                                    inter_price = inter_price / 24 ;
                                }
                                nas_price += inter_price;
                                f(a);
                            }else{
                                errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                                app.STD_END();
                            }
                        }
                        var cas = new Cashier();
                        var charge_data = {};
                        charge_data.PRODUCT_TYPE = "other";
                        charge_data.product_specification_lcuuid = nas_data.PRODUCT_SPECIFICATION_LCUUID;
                        charge_data.DOMAIN = nas_data.DOMAIN;
                        cas.get_charge_info(charge_data,cashierCallback);
                    }else{
                        inter_price = nas_map.get(nas_data.PRODUCT_SPECIFICATION_LCUUID);
                        nas_price += inter_price;
                        f(a);
                    }
                });
            })(nas_data)
        }
    }

    if('VMSNAPSHOT' in data){
        var vmsnapshot = data.VMSNAPSHOT;
        var inter_price = 0 ;
        flow_steps.push(function(a, f) {
            var cashierCallback = function(rdata){
                var filter = {};
                if('OPT_STATUS' in rdata && rdata.OPT_STATUS == 'SUCCESS' && 'DATA' in rdata){
                    inter_price = parseFloat(rdata.DATA.PRICE);
                    var charge_mode =parseInt(rdata.DATA.CHARGE_MODE);
                    if(charge_mode == 1){
                        inter_price = inter_price * 60 * 60 ;
                    }else if(charge_mode == 2){
                        inter_price = inter_price * 60 ;
                    }else if(charge_mode == 4){
                        inter_price = inter_price / 24 ;
                    }
                    vmsnapshot_price += inter_price;
                    f(a);
                }else{
                    errorcallback(400, {OPT_STATUS: constr.OPT.FAIL,DESCRIPTION: 'get price is not specified'});
                    app.STD_END();
                }
            }
            var cas = new Cashier();
            var charge_data = {};
            charge_data.PRODUCT_TYPE = "snapshot";
            charge_data.SIZE = vmsnapshot.SIZE;
            charge_data.DOMAIN = vmsnapshot.DOMAIN;
            cas.get_charge_info(charge_data,cashierCallback);
        });
    }

    flow_steps.push(function(a, f) {
        if(ips_price != 0){
            price += ips_price;
            logger.info("user "+data.USERID+" ips_price is "+ips_price+",price is "+price);
        }
        if(vgw_price != 0){
            price += vgw_price;
            logger.info("user "+data.USERID+" vgw_price is "+vgw_price+",price is "+price);
        }
        if(vm_price != 0){
            price += vm_price;
            logger.info("user "+data.USERID+" vm_price is "+vm_price+",price is "+price);
        }
        if(lb_price != 0){
            price += lb_price;
            logger.info("user "+data.USERID+" lb_price is "+lb_price+",price is "+price);
        }
        if(bw_price != 0){
            price += bw_price;
            logger.info("user "+data.USERID+" bw_price is "+bw_price+",price is "+price);
        }
        if(scanners_price != 0){
            price += scanners_price;
            logger.info("user "+data.USERID+" scanners_price is "+scanners_price+",price is "+price);
        }
        if(nas_price != 0){
            logger.info("user "+data.USERID+" nas_price is "+nas_price+",price is "+price);
            price += nas_price;
            logger.info("user "+data.USERID+" nas_price is "+nas_price+",price is "+price);
        }
        if(vmsnapshot_price != 0){
            price += vmsnapshot_price;
            logger.info("user "+data.USERID+" vmsnapshot_price is "+vmsnapshot_price+",price is "+price);
        }

        logger.info("user "+data.USERID+" balance is "+balance+",price is " + price);
        if((balance - price) >= 0){
            callback(true);
        }else{
            callback(false);
        }
    })
    app.fire('', function(){logger.info('check balance continue finished.');});
}

function Map(){
    this.container = new Object();
}

Map.prototype.put = function(key, value){
    this.container[key] = value;
}

Map.prototype.get = function(key){
    return this.container[key];
}

Map.prototype.keySet = function() {
    var keyset = new Array();
    var count = 0;
    for (var key in this.container) {
        if (key == 'extend') {
            continue;
        }
        keyset[count] = key;
        count++;
    }
    return keyset;
}

module.exports = Balance;
