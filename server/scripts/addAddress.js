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
        var addr = yield Address.add(process.argv[2]);
        console.log('Added Addr:', addr.address);
        process.exit();
    }
    catch(err){
        console.log('Error', err.err);
        process.exit();
    }
});
