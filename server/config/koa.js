var bodyParser = require('koa-bodyparser');
var logger = require('koa-logger');
var redis = require('redis');
var ratelimit = require('koa-better-ratelimit');

module.exports = function (app, config) {
    app.poweredBy = false;
    //Log!
    if (config.app.env === 'development')
        app.use(logger());
    if (config.app.env !== 'development')
        app.use(ratelimit({
            duration: 1000 * 60 * 5, //5 min
            max: 100,
            }));
    //Parse body!
    app.use(bodyParser());
};
