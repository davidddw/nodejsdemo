mysql = require('mysql');

// a simple sql handler

var sqlPoolHandler = mysql.createPool({
    host : '10.33.37.28',
    user : 'cloud',
    password : 'security421',
    database : 'livecloud',
    //waitForConnections : false,
    connectionLimit : 20,
    port : 20130,
    queueLimit : 0
});
module.exports = sqlPoolHandler;


