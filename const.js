/**** OPT_STATUS：每增加一个OPT_STATUS，请相应增加它的中英文翻译 ****/
var logger = require('./logger.js');
var sqlHandler = require('./sql.js');
var util = require('util');
BSS_ADDR = '10.33.37.27';
APP_KEY = '5ee218a0-25ec-463a-81f5-6c5364707cda';
MT_KEY = '6e79a5b1-df16-4946-aeb8-cdd6c9ea43d0';

APP_DEBUG_MODE = false;

PACK_POOL_TYPE_VMWARE = 'vmware';
PACK_POOL_TYPE_2CLOUD = '2cloud';
PACK_POOL_TYPE_AZURE = 'azure';

VMWARE_LEARN_INTERVAL = 3*60*1000;

DEFAULT_PAGE_SIZE = 10;

OPT = {
    'NOT_ENOUGH_IP_RESOURCE':         'NOT_ENOUGH_IP_RESOURCE',
    'DB_QUERY_ERROR':                 'DB_QUERY_ERROR',
    'CALL_API_FAIL':                  'CALL_API_FAIL',
    'INSUFFICIENT_BALANCE':           'INSUFFICIENT_BALANCE',
    'ORDER_PROCESS_ERROR':            'ORDER_PROCESS_ERROR',
    'VIF_IS_IN_FLOW':                 'VIF_IS_IN_FLOW',

    /* Talker OPT_STATUS: */
    'SUCCESS':                        'SUCCESS',
    'FAIL':                           'FAIL',
    'DATABASE_ERROR':                 'DATABASE_ERROR',
    'RESOURCE_NOT_FOUND':             'RESOURCE_NOT_FOUND',
    'RESOURCE_ALREADY_EXIST':         'RESOURCE_ALREADY_EXIST',
    'RESOURCE_STATE_ERROR':           'RESOURCE_STATE_ERROR',
    'RESOURCE_UPDATE_ERROR':          'RESOURCE_UPDATE_ERROR',
    'PARAMETER_ILLEGAL':              'PARAMETER_ILLEGAL',
    'INVALID_POST_DATA':              'INVALID_POST_DATA',
    'INVALID_NAT_DATA':               'INVALID_NAT_DATA',
    'RESOURCE_OPERATE_NONE':          'RESOURCE_OPERATE_NONE',
    'OPERATION_TIMEOUT':              'OPERATION_TIMEOUT',
    'SERVER_ERROR':                   'SERVER_ERROR',
    'SERVER_ERROR_TRY_AGAIN':         'SERVER_ERROR_TRY_AGAIN',
    'PREREQUISITES_NOT_SATISFIED':    'PREREQUISITES_NOT_SATISFIED',
    'REQUEST_FAILED':                 'REQUEST_FAILED',
    'VLANTAG_CONFLICT':               'VLANTAG_CONFLICT',
    'QUOTA_EXCEEDED':                 'QUOTA_EXCEEDED',
    'IP_RESOURCE_INUSE':              'IP_RESOURCE_INUSE',
    'INVALID_IP_RESOURCE':            'INVALID_IP_RESOURCE',
    'INVALID_SNAT_TARGET':            'INVALID_SNAT_TARGET',
    'EXCESSIVE_IP_RESOURCE':          'EXCESSIVE_IP_RESOURCE',
    'INVALID_VGATEWAY_ROUTE':         'INVALID_VGATEWAY_ROUTE',
    'NOT_ENOUGH_BANDWIDTH':           'NOT_ENOUGH_BANDWIDTH',
    'LAN_STILL_ATTACHED':             'LAN_STILL_ATTACHED',
    'RESOURCE_DELETE_PROHIBITED':     'RESOURCE_DELETE_PROHIBITED',
    'VL2_DELETE_PROHIBITED':          'VL2_DELETE_PROHIBITED',
    'EPC_NOT_EMPTY':                  'EPC_NOT_EMPTY',
    'INSTANCE_STATE_NOT_RUNNING ':    'INSTANCE_STATE_NOT_RUNNING',
    'LISTENER_ALREADY_EXIST':         'LISTENER_ALREADY_EXIST',
    'LAN_IP_CONFLICT':                'LAN_IP_CONFLICT',
    'LAN_IP_INVALID':                 'LAN_IP_INVALID',
    'LAN_IP_CONFLICT_WITH_SYS':       'LAN_IP_CONFLICT_WITH_SYS',
    'PRODUCT_NOT_EXIST':              'PRODUCT_NOT_EXIST',
    'NOT_ENOUGH_USER_BALANCE':        'NOT_ENOUGH_USER_BALANCE',
    'SNAPSHOT_ALREADY_EXIST':         'SNAPSHOT_ALREADY_EXIST',
    'SNAPSHOT_NOT_EXIST':             'SNAPSHOT_NOT_EXIST',
    'SNAPSHOT_DELETE_PROHIBITED':     'SNAPSHOT_DELETE_PROHIBITED',
    'OP_PROHIBITED_WHEN_REVERTING':   'OP_PROHIBITED_WHEN_REVERTING',
    'EPC_ALREADY_EXIST':              'EPC_ALREADY_EXIST',
    'FORWARD_RULE_IN_USE':            'FORWARD_RULE_IN_USE',
    'REGULAR_EXPRESSION_ILLEGAL':     'REGULAR_EXPRESSION_ILLEGAL',
    'LISTENER_NUM_EXCEEDED':          'LISTENER_NUM_EXCEEDED',
    'EPC_DOMAIN_DIFFERENT':           'EPC_DOMAIN_DIFFERENT',
    'IP_MAX_NUM_EXCEEDED':            'IP_MAX_NUM_EXCEEDED',
    'BW_MAX_NUM_EXCEEDED':            'BW_MAX_NUM_EXCEEDED',
    'VGW_MAX_NUM_EXCEEDED':           'VGW_MAX_NUM_EXCEEDED',
    'VM_MAX_NUM_EXCEEDED':            'VM_MAX_NUM_EXCEEDED',
    'LB_MAX_NUM_EXCEEDED':            'LB_MAX_NUM_EXCEEDED',
    'VFW_MAX_NUM_EXCEEDED':           'VFW_MAX_NUM_EXCEEDED',
    'ORDER_NOT_PAY':                  'ORDER_NOT_PAY',
    'RESOURCE_OPTION_PROHIBITED':     'RESOURCE_OPTION_PROHIBITED',
    'BACKUP_LB_EXIST_AS_BK_VM':       'BACKUP_LB_EXIST_AS_BK_VM',
    'VM_EXIST_AS_LB_BK_VM':           'VM_EXIST_AS_LB_BK_VM',
    'CURRENT_SNAPSHOT_IS_CREATING':   'CURRENT_SNAPSHOT_IS_CREATING',
    'VM_STATE_BUSY':                  'VM_STATE_BUSY',
    'OTHER_SNAPSHOT_OP_IN_PROGRESS':  'OTHER_SNAPSHOT_OP_IN_PROGRESS',
    'BLOCK_NOT_EXIST':                'BLOCK_NOT_EXIST',
    'REVERT_PROHIBITED_WHEN_VM_IS_STOPPED': 'REVERT_PROHIBITED_WHEN_VM_IS_STOPPED',
    'STORAGE_NOT_EXIST':              'STORAGE_NOT_EXIST',
    'INVALID_VOLUME_SIZE':            'INVALID_VOLUME_SIZE',
    'POOL_NOT_EXIST':                 'POOL_NOT_EXIST',
    'VOL_NOT_EXIST':                  'VOL_NOT_EXIST',
    'VOL_IS_ATTACHED':                'VOL_IS_ATTACHED',
    'BACKUP_JOB_RUNNING':             'BACKUP_JOB_RUNNING',
    'PG_NOT_SUPPORTED':               'PG_NOT_SUPPORTED',
    'PG_IN_CONFLICT_VL2':             'PG_IN_CONFLICT_VL2',
    'PG_IN_CONFLICT_VL2VLAN':         'PG_IN_CONFLICT_VL2VLAN',
    'PG_IN_JOIN_UP':                  'PG_IN_JOIN_UP',
    'LAN_IP_ALLOCATION_FAIL':         'LAN_IP_ALLOCATION_FAIL',
    'NO_DEFAULT_MS':                  'NO_DEFAULT_Micro-segmentation',
    'ADD_TO_DEFAULT_MS_FAIL':         'ADD_TO_DEFAULT_Micro-segmentation_FAIL',
    'REDUCE_CAPACITY_PROHIBITED':     'REDUCE_CAPACITY_PROHIBITED',
    'RELATED_MS_FLOW_EXIST':          'RELATED_MS_FLOW_EXIST',
    'OVERSUBSCRIBED_BANDWIDTH':       'OVERSUBSCRIBED_BANDWIDTH',
    'RESOURCE_ALLOCATION_FAILED':     'RESOURCE_ALLOCATION_FAILED',
    'BLOCK_DETACH_FAIL_VM_ISOLATED':  'BLOCK_DETACH_FAIL_VM_ISOLATED',
    'BLOCK_DETACH_FAIL_VM_HALTED':    'BLOCK_DETACH_FAIL_VM_HALTED',
    'BLOCK_IS_BUSY':                  'BLOCK_IS_BUSY',
    'SN_ISOLATE_NOT_SUPPORT':         'SN_ISOLATE_NOT_SUPPORT',
    'VAGENT_NOT_MATCH':               'VAGENT_NOT_MATCH',
    'VM_IS_PLUGGING_BLOCK':           'VM_IS_PLUGGING_BLOCK',
};

OPT_CH = {
    'NOT_ENOUGH_IP_RESOURCE':         '公网IP不足，管理员将会尽快添加公网IP资源',
    'DB_QUERY_ERROR':                 '数据库查询失败',
    'CALL_API_FAIL':                  '底层API调用失败',
    'INSUFFICIENT_BALANCE':           '您的账户余额不足，请确认余额足够所有资源使用7天',
    'ORDER_PROCESS_ERROR':            '您的订单提交失败，管理员将会尽快修复',
    'VIF_IS_IN_FLOW':                 '设备该接口已配置在公网防护或微安全域策略中，请先删除策略再修改接口',

    /* Talker OPT_STATUS: */
    'SUCCESS':                        '',
    'FAIL':                           '失败',
    'DATABASE_ERROR':                 '数据库表项错误',
    'RESOURCE_NOT_FOUND':             '资源不存在',
    'RESOURCE_ALREADY_EXIST':         '资源已存在',
    'RESOURCE_STATE_ERROR':           '资源状态错误',
    'RESOURCE_UPDATE_ERROR':          '资源更新失败',
    'PARAMETER_ILLEGAL':              '参数不合法',
    'INVALID_POST_DATA':              '请求数据不合法',
    'INVALID_NAT_DATA':               '检查目的地址转换和源地址转换的配置后发现，同一个私有网络地址映射到了多个ISP的地址。',
    'RESOURCE_OPERATE_NONE':          '资源操作不识别',
    'OPERATION_TIMEOUT':              '操作超时',
    'SERVER_ERROR':                   '系统内部错误',
    'SERVER_ERROR_TRY_AGAIN':         '系统繁忙,请稍后重试',
    'PREREQUISITES_NOT_SATISFIED':    '预置条件不满足',
    'REQUEST_FAILED':                 '请求失败',
    'VLANTAG_CONFLICT':               'VLAN冲突',
    'QUOTA_EXCEEDED':                 '配额超限',
    'IP_RESOURCE_INUSE':              '该IP正在使用中，无法删除',
    'INVALID_IP_RESOURCE':            '同一个接口上的公网IP必须拥有相同的VLAN，且IP所在资源池必须和设备所在资源池相同。',
    'INVALID_SNAT_TARGET':            'SNAT出口IP没有在虚拟网关上配置，请检查出口IP是否正确',
    'EXCESSIVE_IP_RESOURCE':          '配置到所有ISP接口的公网IP数目超过规格限定',
    'INVALID_VGATEWAY_ROUTE':         '路由的下一跳必须和虚拟网关某个接口的IP在同一网段内',
    'NOT_ENOUGH_BANDWIDTH':           'ISP带宽不足，已使用的带宽超过了购买的带宽',
    'LAN_STILL_ATTACHED':             '请先清除私有网络连接配置',
    'RESOURCE_DELETE_PROHIBITED':     '当前状态禁止删除操作，仅当停止状态下才能删除',
    'VL2_DELETE_PROHIBITED':          '请先清除该私有网络中的所有连接和安全域',
    'EPC_NOT_EMPTY':                  '请先移出当前私有云中资源',
    'INSTANCE_STATE_NOT_RUNNING ':    '当前状态禁止操作，仅当运行状态才能配置',
    'LISTENER_ALREADY_EXIST':         '与已有监听器名称冲突，请检查配置',
    'LAN_IP_CONFLICT':                '您配置的私有网络IP/网段和EPC中其它IP/网段冲突',
    'LAN_IP_INVALID':                 '您配置的私有网络IP/网段或IP数目不合法，IP/网段应为0.0.0.0/0且数目仅为1',
    'LAN_IP_CONFLICT_WITH_SYS':       '您配置的私有网络IP/网段和系统控制、服务平面网段冲突',
    'PRODUCT_NOT_EXIST':              '您选择的产品不存在',
    'NOT_ENOUGH_USER_BALANCE':        '您的账户余额不足开通资源',
    'SNAPSHOT_ALREADY_EXIST':         '当前虚拟机已存在快照信息, 请先删除当前快照',
    'SNAPSHOT_NOT_EXIST':             '您选择的快照不存在',
    'SNAPSHOT_DELETE_PROHIBITED':     '您选择的快照正在恢复，不能进行删除操作',
    'OP_PROHIBITED_WHEN_REVERTING':   '当前虚拟机正在进行快照恢复, 不能执行其他操作',
    'EPC_ALREADY_EXIST':              '已存在同名私有云',
    'FORWARD_RULE_IN_USE':            '当前转发规则还在使用中，请先在负载均衡器配置页面解除规则绑定',
    'REGULAR_EXPRESSION_ILLEGAL':     '正则表达式不合法',
    'LISTENER_NUM_EXCEEDED':          '当前负载均衡器上监听器数目超出限制，最多允许配置32个监听器',
    'EPC_DOMAIN_DIFFERENT':           '移入EPC失败，数据中心不一致',
    'IP_MAX_NUM_EXCEEDED':            '创建IP资源超过最大1000数量限制',
    'BW_MAX_NUM_EXCEEDED':            '创建带宽资源超过最大1000数量限制',
    'VGW_MAX_NUM_EXCEEDED':           '创建虚拟网关资源超过最1000大数量限制',
    'VM_MAX_NUM_EXCEEDED':            '创建虚拟服务器资源超过最大1000数量限制',
    'LB_MAX_NUM_EXCEEDED':            '创建负载均衡器资源超过最大1000数量限制',
    'VFW_MAX_NUM_EXCEEDED':           '创建虚拟防火墙资源超过最大1000数量限制',
    'ORDER_NOT_PAY':                  '订单没有交付，请交付后使用',
    'RESOURCE_OPTION_PROHIBITED':     '当前状态禁止对虚拟机操作',
    'BACKUP_LB_EXIST_AS_BK_VM':       '您选择的高可用备机当前作为后端主机使用中, 请先从其他负载均衡器的后端主机中将其移除',
    'VM_EXIST_AS_LB_BK_VM':           '当前虚拟机作为后端主机使用中, 请先在负载均衡器配置页面将其移除',
    'CURRENT_SNAPSHOT_IS_CREATING':   '当前虚拟机正在创建其他快照，请稍后再试',
    'VM_IS_PLUGGING_BLOCK':           '虚拟机正在挂载磁盘，请稍后再试',
    'OTHER_SNAPSHOT_OP_IN_PROGRESS':  '当前虚拟机正在执行其他快照任务，请稍后再试',
    'BLOCK_NOT_EXIST':                '云硬盘不存在',
    'STORAGE_NOT_EXIST':              '内部错误，请联系管理员',
    'INVALID_VOLUME_SIZE':            '云硬盘大小错误',
    'POOL_NOT_EXIST':                 '内部错误，请联系管理员',
    'VOL_NOT_EXIST':                  '内部错误，请联系管理员',
    'VOL_IS_ATTACHED':                '云硬盘已被挂载到虚拟机上',
    'SNAPSHOT_NUM_EXCEEDED':          '快照数目超出限制',
    'REVERT_PROHIBITED_WHEN_VM_IS_STOPPED':      '快照只能在虚拟机启动状态下恢复',
    'RESIZE_PROHIBITED_WHEN_VOL_IS_ATTACHED':    '当前云硬盘已经被挂载, 禁止扩容操作',
    'DELETE_VM_PROHIBITED_WHEN_VOL_IS_ATTACHED': '当前虚拟机上挂载着云硬盘, 禁止删除操作',
    'BACKUP_JOB_RUNNING':             '备份任务运行时，禁止删除备份空间',
    'PG_NOT_SUPPORTED':               '您所添加的端口组属于ISP网络类型，不允许接入私有网络',
    'PG_IN_CONFLICT_VL2':             '您所添加的端口组已经被接入到其他私有网络中',
    'PG_IN_CONFLICT_VL2VLAN':         '您所添加的端口组与目标私有网络中已有的其他接口或端口组的VLAN有冲突，或者与之VLAN相同的其他接口或端口组已经被接入到其他私有网络中',
    'PG_IN_JOIN_UP':                  '端口组已经接入到私有网络中',
    'LAN_IP_ALLOCATION_FAIL':         '内网IP分配失败',
    'NO_DEFAULT_MS':                  '没有默认安全域',
    'ADD_TO_DEFAULT_MS_FAIL':         '加入默认安全域失败',
    'REDUCE_CAPACITY_PROHIBITED':     '扩容操作只允许增大容量',
    'RELATED_MS_FLOW_EXIST':          '当前虚拟安全域中仍存在未删除的服务链配置策略，删除之前请先删除相关服务链配置',
    'OVERSUBSCRIBED_BANDWIDTH':       '您所配置的带宽值已超过该产品规格的带宽限制',
    'RESOURCE_ALLOCATION_FAILED':     '底层资源分配失败',
    'BLOCK_DETACH_FAIL_VM_ISOLATED':  '请重连虚拟机之后在卸载云硬盘',
    'BLOCK_DETACH_FAIL_VM_HALTED':    '请启动虚拟机之后在卸载云硬盘',
    'BLOCK_IS_BUSY':                  '请在虚拟机内解挂(umount)云硬盘之后在卸载云硬盘',
    'SN_ISOLATE_NOT_SUPPORT':         '目前暂不支持对安全设备执行隔离操作',
    'VAGENT_NOT_MATCH':               '虚拟机的VAGENT版本较低，请先升级',
};

OPT_EN = {
    'NOT_ENOUGH_IP_RESOURCE':         "Not enough ip resource, Admin must add more ip using `mt ip.add'.",
    'DB_QUERY_ERROR':                 'DB error.',
    'CALL_API_FAIL':                  'Kernel API failed.',
    'INSUFFICIENT_BALANCE':           'Your balance is not enough.',
    'ORDER_PROCESS_ERROR':            'Order submit failed.',
    'VIF_IS_IN_FLOW':                 'vif is in service flow',

    /* Talker OPT_STATUS: */
    'SUCCESS':                        '',
    'FAIL':                           'Failed.',
    'DATABASE_ERROR':                 'Database table entry error.',
    'RESOURCE_NOT_FOUND':             'Resource not found.',
    'RESOURCE_ALREADY_EXIST':         'Resource already exist.',
    'RESOURCE_STATE_ERROR':           'Resource state error.',
    'RESOURCE_UPDATE_ERROR':          'Resource update failed.',
    'PARAMETER_ILLEGAL':              'Parameter illegal.',
    'INVALID_POST_DATA':              'Invalid post data.',
    'INVALID_NAT_DATA':               'After checking the configuration of SNAT and DNAT, it is found that one private IP address is mapped to IP addresses of multiple ISPs.',
    'RESOURCE_OPERATE_NONE':          'Unknown resource operation.',
    'OPERATION_TIMEOUT':              'Operation timeout.',
    'SERVER_ERROR':                   'Server error.',
    'SERVER_ERROR_TRY_AGAIN':         'Server error.please try again.',
    'PREREQUISITES_NOT_SATISFIED':    'Prerequisites not satisfied.',
    'REQUEST_FAILED':                 'Request failed.',
    'VLANTAG_CONFLICT':               'Vlantag conflict.',
    'QUOTA_EXCEEDED':                 'Quota exceeded.',
    'IP_RESOURCE_INUSE':              'IP resource in use, can not delete.',
    'INVALID_IP_RESOURCE':            'Invalid IP, please make sure IPs for the same port have the same VLAN, and belong to the same resource pool.',
    'INVALID_SNAT_TARGET':            'Invalid SNAT target IP, please make sure the target IP is configured in vgateway.',
    'EXCESSIVE_IP_RESOURCE':          'The number of configured IPs exceeds the production specified.',
    'INVALID_VGATEWAY_ROUTE':         'The next-hop must in the same VNET with one of the interfaces.',
    'NOT_ENOUGH_BANDWIDTH':           'No enough bandwidth.',
    'LAN_STILL_ATTACHED':             'Please clear LAN network config.',
    'RESOURCE_DELETE_PROHIBITED':     'Resource delete prohibited in current state, cannot delete when state is not stopped.',
    'VL2_DELETE_PROHIBITED':          'Please clear all network connections and Micro-segements in this VNET at first.',
    'EPC_NOT_EMPTY':                  'Please remove the resources in the EPC.',
    'INSTANCE_STATE_NOT_RUNNING':     'Instance configure prohibited in current state, cannot operate when state is not running.',
    'LISTENER_ALREADY_EXIST':         'Listener name conflict, please check configure.',
    'LAN_IP_CONFLICT':                'VNET ip or prefix is conflict.',
    'LAN_IP_INVALID':                 'VNET ip or prefix is invalid, or more than one ip is added into VNET.',
    'LAN_IP_CONFLICT_WITH_SYS':       'VNET ip or prefix is conflict.',
    'PRODUCT_NOT_EXIST':              'Product not found.',
    'NOT_ENOUGH_USER_BALANCE':        'No enough user balance.',
    'SNAPSHOT_ALREADY_EXIST':         'Snapshot already exist, please delete current snapshot.',
    'SNAPSHOT_NOT_EXIST':             'Snapshot not found.',
    'SNAPSHOT_DELETE_PROHIBITED':     'Snapshot is reverting, cannot be deleted.',
    'OP_PROHIBITED_WHEN_REVERTING':   'VM operation prohibited in reverting state.',
    'EPC_ALREADY_EXIST':              'EPC with the same name already exists, please change into another name.',
    'FORWARD_RULE_IN_USE':            'Forwarding rule is still in use, please unbind it in loadbalancer configure page.',
    'REGULAR_EXPRESSION_ILLEGAL':     'Regular expression illegal.',
    'LISTENER_NUM_EXCEEDED':          'Listener num exceeded in current loadbalancer, maximum is 32.',
    'EPC_DOMAIN_DIFFERENT':           'Set EPC error, domain is different.',
    'IP_MAX_NUM_EXCEEDED':            'Create IP error, max num is 1000.',
    'BW_MAX_NUM_EXCEEDED':            'Create bandwidth error, max num is 1000.',
    'VGW_MAX_NUM_EXCEEDED':           'Create vgateway error, max num is 1000.',
    'VM_MAX_NUM_EXCEEDED':            'Create VM error, max num is 1000.',
    'LB_MAX_NUM_EXCEEDED':            'Create loadbalancer error, max num is 1000.',
    'VFW_MAX_NUM_EXCEEDED':           'Create vFW error, max num is 1000.',
    'ORDER_NOT_PAY':                  'Order not paid, please use after paid.',
    'RESOURCE_OPTION_PROHIBITED':     'VM operation prohibited in current state.',
    'BACKUP_LB_EXIST_AS_BK_VM':       'Backup loadbalancer exists as backend VM, please remove it in other loadbalancers configure page.',
    'VM_EXIST_AS_LB_BK_VM':           'VM exists as a backend VM, please remove it in loadbalancers configure page.',

    'CURRENT_SNAPSHOT_IS_CREATING':   'Current VM is creating another snapshot, please try later.',
    'VM_IS_PLUGGING_BLOCK':           'VM is plugging another block device, please try later.',
    'OTHER_SNAPSHOT_OP_IN_PROGRESS':  'Current VM is running another snapshot task, please try later.',
    'BLOCK_NOT_EXIST':                'Cloud disk not found.',
    'STORAGE_NOT_EXIST':              'Internal error, please contact administrator.',
    'INVALID_VOLUME_SIZE':            'Invalid cloud disk size.',
    'POOL_NOT_EXIST':                 'Internal error, please contact administrator.',
    'VOL_NOT_EXIST':                  'Internal error, please contact administrator.',
    'VOL_IS_ATTACHED':                'Cloud disk is already attached to a VM.',
    'SNAPSHOT_NUM_EXCEEDED':          'Max snapshot num exceeded.',
    'REVERT_PROHIBITED_WHEN_VM_IS_STOPPED':      'Snapshot revert prohibited when vm is stopped.',
    'RESIZE_PROHIBITED_WHEN_VOL_IS_ATTACHED':    'Cloud disk resize prohibited when it is attached.',
    'DELETE_VM_PROHIBITED_WHEN_VOL_IS_ATTACHED': 'VM delete prohibited when cloud disk is attached.',
    'BACKUP_JOB_RUNNING':             'Can not delete backup space when backup job is running.',
    'PG_NOT_SUPPORTED':               'Port group cannot be connected to the target VNET due to its ISP type.',
    'PG_IN_CONFLICT_VL2':             'Port group has already been connected to some other VNET.',
    'PG_IN_CONFLICT_VL2VLAN':         'Port group conflicts with existing vinterfaces or port groups of the target VNET in terms of VLAN, or some other vinterface or port group with the same VLAN has already been connected to a different VNET.',
    'PG_IN_JOIN_UP':                  'Port group has already been connected to a VNET.',
    'REDUCE_CAPACITY_PROHIBITED':     'Reduce capacity prohibited.',
    'RELATED_MS_FLOW_EXIST':          'Micro segment cannot be deleted when the policy configuration of related service chains still exists.',
    'OVERSUBSCRIBED_BANDWIDTH':       'The configured bandwidth exceeds the upper limit of corresponding product specification.',
    'RESOURCE_ALLOCATION_FAILED':     'The related resources cannot be allocated.',
    'BLOCK_DETACH_FAIL_VM_ISOLATED':  'The block cannot be detached when the VM has been isolated',
    'BLOCK_DETACH_FAIL_VM_HALTED':    'The block cannot be detached when the VM has benn stopped',
    'BLOCK_IS_BUSY':                  'Please unmount the block first in the VM',
    'SN_ISOLATE_NOT_SUPPORT':         'Service node cannot be isolated',
    'VAGENT_NOT_MATCH':               'The vagent is not match the request, please update it first',
};

/**** instance-roles ****/

INSTANCE_ROLE_ARRAY = {
    'GENERAL_PURPOSE': { "CH": "通用",       "EN": "General"           },
    'LOAD_BALANCER':   { "CH": "负载均衡器", "EN": "Load Balancer"     },
    'DATABASE':        { "CH": "数据库",     "EN": "Database"          },
    'WEB_SERVER':      { "CH": "Web服务器",  "EN": "Web Server"        },
    'APP_SERVER':      { "CH": "应用服务器", "EN": "App Server"        },
    'FIREWALL':        { "CH": "防火墙",     "EN": "Firewall"          },
    'GATEWAY':         { "CH": "网关",       "EN": "Gateway"           },
    'VPN':             { "CH": "VPN",        "EN": "VPN"               },
    'STORAGE':         { "CH": "存储服务器", "EN": "Storage Server"    },
    'WAF':             { "CH": "WAF",        "EN": "WAF"               },
    'VALVE':           { "CH": "带宽共享器", "EN": "Bandwidth Sharer"  },
};

/****operation_log objtyoe****/
OBJ_TYPE_ARRAY = {
    'vm':                            '虚拟主机',
    'vgateway':                      '虚拟网关',
    'vl2':                           '虚拟二层子网',
    'ISP IP':                        'ISP地址',
    'ISP Bandwidth':                 'ISP带宽',
    'thirdhw':                       '专属设备',
    'epc':                           '私有云',
    'user':                          '用户',
    'nas':                           'NAS存储服务',
    'cloud_disk':                    '云硬盘',
    'lb':                            '负载均衡器',
    'lb_forward_rule':               '负载均衡器规则',
    'vfw':                           '虚拟防火墙',
    'valve':                         '带宽共享器',
};

OPERATION_ARRAY = {
    'create':                        '创建',
    'delete':                        '删除',
    'plug':                          '挂载',
    'unplug':                        '卸载',
    'modify':                        '修改',
    'update':                        '更新',
    'start':                         '启动',
    'stop':                          '停止',
    'modifyinterface':               '修改虚拟接口',
    'setepc':                        '移入私有云',
    'remove_epc':                    '移出私有云',
    'login':                         '登录',
    'logout':                        '退出',
    'console':                       '连接控制台',
    'recoversnapshot':               '恢复快照',
    'config':                        '配置',
    'snapshot':                      '创建快照',
    'reconnect':                     '解除隔离',
    'isolate':                       '隔离',
    'delsnapshot':                   '删除快照',
    'create_ha_cluster':             '配置高可用',
    'update_ha_cluster':             '更新高可用',
    'delete_ha_cluster':             '删除高可用',
    'delete_lb_listener':            '删除监听器',
};

PRODUCT_TYPES = {
    'STORAGE':      19,
}

BLOCK_DEVICE = {
    'STATE': {
        'DETTAHED': 0,
        'ATTACHED': 1
    }
}

BSS_IP = '';
OSS_IP = '';
OSS_DOMAIN = '';
sqlHandler.getConnection(function(err, connection){
    if (err){
        logger.error(util.inspect(err));
        return errorcallback(500);
    }
    connection.query('select * from domain_v2_2', [], function(err, ans){
        logger.info(this.sql);
        connection.release();
        if (err){
            logger.error(logger(err));
            errorcallback(500);
        } else{
            ans.forEach(function(i){
                if (i.role == 1){
                    BSS_IP = i.ip;
                    logger.info('set bss ip: '+BSS_IP);
                } else if (i.role == 2){
                    OSS_IP = i.ip;
                    OSS_DOMAIN = i.lcuuid
                }
            })
        }
    })
})
getBss = function(){return BSS_IP;}
getOss = function(){return OSS_IP;}
getOssDomain = function(){return OSS_DOMAIN;}

MAX_VM_CONCURRENCY = 2;

module.exports = {
    KEY: APP_KEY,
    OPT: OPT,
    APP_KEY: APP_KEY,
    MT_KEY: MT_KEY,
    PACK_POOL_TYPE_VMWARE: PACK_POOL_TYPE_VMWARE,
    PACK_POOL_TYPE_2CLOUD: PACK_POOL_TYPE_2CLOUD,
    PACK_POOL_TYPE_AZURE: PACK_POOL_TYPE_AZURE,
    VMWARE_LEARN_INTERVAL: VMWARE_LEARN_INTERVAL,
    OPT_CH: OPT_CH,
    OPT_EN: OPT_EN,
    INSTANCE_ROLE_ARRAY: INSTANCE_ROLE_ARRAY,
    OPERATION_ARRAY: OPERATION_ARRAY,
    OBJ_TYPE_ARRAY: OBJ_TYPE_ARRAY,
    PRODUCT_TYPES: PRODUCT_TYPES,
    BLOCK_DEVICE: BLOCK_DEVICE,
    SQL_VERSION: '_v2_2',
    getBss: getBss,
    getOss: getOss,
    getOssDomain: getOssDomain,
    MAX_VM_CONCURRENCY: MAX_VM_CONCURRENCY,
    APP_DEBUG_MODE: APP_DEBUG_MODE,
};
