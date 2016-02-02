//parser of api-event-pop protocols

var parser = {
    generateEventParser : function(a){return a.event_parser},
    generateUrlParser : function(a){return a.url_parser},
}

module.exports = parser;
