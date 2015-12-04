#!/usr/bin/env node
'use strict';
var co = require('co');
var mongoose = require('mongoose');

require('../models/bets');
var Bet = require('mongoose').model('Bet');
var config = require('../config/config');

mongoose.connect(config.mongo.url);
mongoose.connection.on('error', function(err){
    console.error('Error connecting to db', err);
});

co(function*(){
    try{
        var bet = yield Bet.add(JSON.parse(process.argv[2]));
        console.log('Added bet', bet);
        process.exit();
    }
    catch(err){
        console.log('Error', err);
        process.exit();
    }
});
