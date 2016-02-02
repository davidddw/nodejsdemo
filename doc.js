var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic('out')).listen(8080)
