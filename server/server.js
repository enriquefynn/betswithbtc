'use strict';
var koa = require('koa');
var cors = require('koa-cors');
var mongoose = require('mongoose');
var config = require('./config/config');

mongoose.connect(config.mongo.url);
mongoose.connection.on('error', function(err){
    console.error('Error connecting to db', err);
});

require('./models/bets');

//Server
var app = module.exports = koa();
app.use(cors());
require('./config/koa')(app, config);
require('./config/routes')(app, config);

if (!module.parent)
{
    console.log('Listening on', config.app.port);
    app.listen(config.app.port);
}
console.log('Environment:', config.app.env);

process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    process.exit();
});
