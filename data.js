var paramsCheck = require('./paramsCheck.js');
var validator = require('validator');
var basicValidator = paramsCheck.basicValidator;
var inValidator = paramsCheck.inValidator;
var lcValidator = paramsCheck.lcValidator;
var flow = require('./flow.js');
var constr = require('./const.js');



var storageCreate = function(){
    var storageCreateValidator = new lcValidator({
        'NAME': new basicValidator(function(name){
            return /^[a-zA-Z0-9_-]{1,31}$/.test(name)}, 'is valid name'),
        'SIZE': new basicValidator(validator.isNumeric, 'isNumeric'),
        'USER_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        '@ORDER_ID': new basicValidator(validator.isNumeric, 'isNumeric'),
        'PRODUCT_SPECIFICATION_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        'FROM_VOLUME': new basicValidator(false),
    })
    storageCreateValidator._strictMode = true;
    return storageCreateValidator;
}

var storageGet = function(){
    var storageGetValidator = new lcValidator({
        '@user-lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@order-id': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@domain': new basicValidator(validator.isUUID, 'isUUID'),
        '@storage-lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@page_size': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@page_index': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@vm-lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@flag': new inValidator([1,2]),
    })
    storageGetValidator._strictMode = true;
    return storageGetValidator;
}

var storageModify = function(){
    var storageModifyValidator = new lcValidator({
        'LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        '@SIZE': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@IOPS': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@THROUGHPUT': new basicValidator(validator.isNumeric, 'isNumeric'),
    })
    storageModifyValidator._strictMode = true;
    return storageModifyValidator;
}

var storageSnapshot = function(){
    var storageSnapshotValidator = new lcValidator({
        'NAME': new basicValidator(function(name){
            return /^[a-zA-Z0-9_-]+$/.test(name)}, 'is valid name'),
        '@DESCRIPTION': new basicValidator(function(name){
            return (''+name).length<=256}, 'length out of range(256)'),
        'PRODUCT_SPECIFICATION_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        'LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
    });
    storageSnapshotValidator._strictMode = true;
    return storageSnapshotValidator;
}

var storageSnapshotGet = function(){
    var storageSnapshotValidator = new lcValidator({
        'BLOCK_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        '@SNAPSHOT_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
    });
    storageSnapshotValidator._strictMode = true;
    return storageSnapshotValidator;
}

var vmSnapshotGet = function(){
    var vmSnapshotValidator = new lcValidator({
        '@vm_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@snapshot_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@userid': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@page_size': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@page_index': new basicValidator(validator.isNumeric, 'isNumeric'),
    });
    vmSnapshotValidator._strictMode = true;
    return vmSnapshotValidator;
}

var subnetExternalPost = function(){
    var newValidator = new lcValidator({
        'type': new inValidator(['VMWARE']),
        'vmware_port_group_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        'vl2_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
    });
    newValidator._strictMode = true;
    return newValidator;
}
var subnetExternalDel = function(){
    var newValidator = new lcValidator({
        'vmware_port_group_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        'vl2_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
    });
    newValidator._strictMode = true;
    return newValidator;
}


var thirdHWparitionValidator = function() { return new lcValidator({
    FSPATH: new inValidator(['/home', '/var', '/tmp']),
    FSTYPE: new inValidator(['ext4', 'ext3', 'ext2']),
    SIZE: new basicValidator(validator.isFloat, 'isFloat'),
})
}


var thirdHWinstallOS = function(){
    var newValidator = new lcValidator({
        RAID: new lcValidator({
            STRIPE_SIZE: new inValidator(['64K', '128K', '256K', '512K', '1M']),
            TYPE: new inValidator([0, 1, 5, 6, 10]),
        }),
        OS: new basicValidator(validator.isAscii, 'isAscii'),
        INIT_PASSWD: new basicValidator(function(str){
            return /^[a-zA-Z0-9_-]+$/.test(str);
        }, 'password format illegal'),
        '@BOOTIF_NAME': new basicValidator(validator.isAscii, 'isAscii'),
        BUILDIN_AGENT: new inValidator([true, false]),
        PARTITIONS: new lcValidator([thirdHWparitionValidator()]),
    });
    newValidator._strictMode = true;
    return newValidator;
}

var thirdHWbuyHW = function(){
    var newValidator = new lcValidator({
        USERID: new basicValidator(validator.isNumeric, 'isNumeric') ,
        ORDER_ID: new basicValidator(validator.isNumeric, 'isNumeric'),
        PRODUCT_SPECIFICATION_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        DOMAIN: new basicValidator(validator.isUUID, 'isUUID'),
        RAID: new lcValidator({
            STRIPE_SIZE: new inValidator(['64K', '128K', '256K', '512K', '1M']),
            TYPE: new inValidator([0, 1, 5, 6, 10]),
        }),
        OS: new basicValidator(validator.isAscii, 'isAscii'),
        INIT_PASSWD: new basicValidator(function(str){
            return /^[a-zA-Z0-9_-]+$/.test(str);
        }, 'password format illegal'),
        '@BOOTIF_NAME': new basicValidator(validator.isAscii, 'isAscii'),
        BUILDIN_AGENT: new inValidator([true, false]),
        PARTITIONS: new lcValidator([thirdHWparitionValidator()]),
    });
    newValidator._strictMode = true;
    return newValidator;
}


var getMsByFilter = function(){
    var newValidator = new lcValidator({
        '@epc_id': new basicValidator(validator.isUUID, 'isUUID'),
        '@vl2_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@isp_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@type': new inValidator(['ISP', 'VGATEWAY', 'HOST', 'SERVICE']),
    });
    newValidator._strictMode = true;
    return newValidator;
}

var getChainByFilter = function(){
    var newValidator = new lcValidator({
        '@epc_id': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@vl2_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@isp_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@src_ms_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
        '@dst_ms_lcuuid': new basicValidator(validator.isUUID, 'isUUID'),
    });
    newValidator._strictMode = true;
    return newValidator;
}

var aclValidator = function(){
    var newValidator = new lcValidator({
        PROTOCOL: new basicValidator(validator.isNumeric, 'isNumeric'),
        DST_PORT: new basicValidator(validator.isNumeric, 'isNumeric') ,
    });
    newValidator._strictMode = true;
    return newValidator;
}

var serviceNodeValidator = function(){
    var newValidator = new lcValidator({
        '@ACLS': new lcValidator([aclValidator()]),
        INSTANCE_TYPE: new inValidator(['VM', 'VGATEWAY']),
        INSTANCE_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        '@INGRESS_IF_INDEX': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@EGRESS_IF_INDEX': new basicValidator(validator.isNumeric, 'isNumeric'),
        '@IS_L3': new inValidator([true, false]),
    })
    newValidator._strictMode = true;
    return newValidator;
}
var createChain = function(){
    var newValidator = new lcValidator({
        SRC_MS_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        DST_MS_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        '@VL2_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        '@ISP_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        EPC_ID: new basicValidator(validator.isNumeric, 'isNumeric'),
        '@NAME': new basicValidator(function(str){
            return /^[a-zA-Z0-9-]{1,20}/.test(str)}, 'name invalid'),
        SERVICES: new lcValidator([serviceNodeValidator()])
    })
    newValidator._strictMode = true;
    return newValidator;
}
var createSouthNorthChain = function(){
    var newValidator = new lcValidator({
        PUBLIC_IP_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        BANDWIDTH: new basicValidator(validator.isNumeric, 'isNumeric'),
        VL2_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        ISP_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
        EPC_ID: new basicValidator(validator.isNumeric, 'isNumeric'),
        '@NAME': new basicValidator(function(str){
            return /^[a-zA-Z0-9-]{1,20}/.test(str)}, 'name invalid'),
        SERVICES: new lcValidator([serviceNodeValidator()]),
    })
    newValidator._strictMode = true;
    return newValidator;
}

var createMs = function(){
    var newValidator = new lcValidator({
        NAME: new basicValidator(function(str){
            return /^[a-zA-Z0-9-]{1,20}/.test(str)}, 'name invalid'),
        EPC_ID: new basicValidator(validator.isNumeric, 'isNumeric'),
        '@TYPE': new inValidator(['GATEWAY', 'HOST']),
        '@VL2_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        '@ISP_LCUUID': new basicValidator(validator.isUUID, 'isUUID'),
        INTERFACES: new lcValidator([new lcValidator({
            INSTANCE_TYPE: new inValidator(['VM', 'VGATEWAY']),
            INSTANCE_LCUUID: new basicValidator(validator.isUUID, 'isUUID'),
            IF_INDEX: new basicValidator(validator.isNumeric, 'isNumeric'),
        })]),
    })
    newValidator._strictMode = true;
    return newValidator;
}

/**common Qpack for validate**/
var checkParamsValid = function(params, dataParse){
    var Q = new flow.Qpack(flow.serial);
    return Q.then(function(placeHolder, onFullfilled){
        dataParse = dataParse ? dataParse : function(data){return data};
        params = params ? params : placeHolder;
        if (!('validator' in params) || !('data' in params))
            throw new Error('checkParamsValid require params has key validator and data');
        data = params.validator.format(params.data);
        if (params.validator.getError()){
            Q.reject({'OPT_STATUS': constr.OPT.FAIL, 'MSG': params.validator.errors});
            onFullfilled('params check failed');
        } else {
            onFullfilled(dataParse(data));
        }
    })
}



module.exports = {
    'storageCreate': storageCreate,
    'storageGet': storageGet,
    'storageModify': storageModify,
    'storageSnapshot': storageSnapshot,
    'storageSnapshotGet':storageSnapshotGet,
    'checkParamsValid': checkParamsValid,
    'vmSnapshotGet':vmSnapshotGet,
    'subnetExternalPost': subnetExternalPost,
    'subnetExternalDel': subnetExternalDel,
    'thirdHWinstallOS': thirdHWinstallOS,
    'thirdHWbuyHW': thirdHWbuyHW,
    'createMs': createMs,
    'getMsByFilter': getMsByFilter,
    'getChainByFilter': getChainByFilter,
    'createChain': createChain,
    'createSouthNorthChain': createSouthNorthChain,
}
