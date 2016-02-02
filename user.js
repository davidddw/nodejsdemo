
var logger = require('./logger.js');
var constr = require('./const.js');

var user_table_name = 'fdb_user_v2_2';

function fill_user_for_bdb_instance(p, app, errorcallback) {
    app.list.push(function(bdb_instances, f) {
        var user_condition = 'SELECT * FROM ?? WHERE id IN (-1';
        var instances_userids = [];
        var i, j;
        for (i = 0; i < bdb_instances.length; ++i) {
            if (!bdb_instances[i].USERID) {
                continue;
            }
            for (j = 0; j < instances_userids.length; ++j) {
                if (instances_userids[j] == bdb_instances[i].USERID) {
                    break;
                }
            }
            if (j >= instances_userids.length) {
                instances_userids.push(bdb_instances[i].USERID);
                user_condition += ',' + instances_userids[j];
            }
        }
        user_condition += ')'

        p.executeSql(user_condition)(
            [user_table_name],
            function(ans){
                var i, j;
                var users = [];
                for (i = 0; i < ans.length; ++i) {
                    users.push({
                        ID: ans[i].id,
                        USERNAME: ans[i].username,
                        STATE: ans[i].state,
                        COMPANY: ans[i].company,
                    });
                }
                for (i = 0; i < bdb_instances.length; i++) {
                    bdb_instances[i].USER = null;
                    for (j = 0; j < users.length; ++j) {
                        if (bdb_instances[i].USERID == users[j].ID) {
                            bdb_instances[i].USER = users[j];
                            break;
                        }
                    }
                }
                f(bdb_instances);
            },
            function(a){
                errorcallback(a, {
                    'OPT_STATUS': constr.OPT.SERVER_ERROR,
                    'DESCRIPTION': 'Exec sql error, select from fdb_user failed.'
                });
                p.STD_END();
            }
        );
    });
}

module.exports = {
    fill_user_for_bdb_instance: fill_user_for_bdb_instance,
};
