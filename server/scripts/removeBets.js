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
        var bets = process.argv.splice(2);
        var betsIds = [];
        for (var i in bets)
        {
            var bet = yield Bet.findByIdAndRemove(bets[i]).exec();
            betsIds.push(bet._id);
        }
        console.log('Bets removed:', betsIds);
        process.exit();
    }
    catch(err){
        console.log('Error', err);
        process.exit();
    }
});
