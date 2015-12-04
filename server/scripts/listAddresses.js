#!/usr/bin/env node
'use strict';
var co = require('co');
var mongoose = require('mongoose');

require('../models/bets');
var Address = require('mongoose').model('Address');
var config = require('../config/config');

mongoose.connect(config.mongo.url);
mongoose.connection.on('error', function(err){
    console.error('Error connecting to db', err);
});

co(function*(){
    try{
        var addrs = yield Address.find().exec();
        console.log('Addresses:', addrs.map(function(b){return b.address;}));
        process.exit();
    }
    catch(err){
        console.log('Error', err);
        process.exit();
    }
});
