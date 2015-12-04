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
        var bets;
        if (process.argv[2] === 'suggestion')
            bets = yield Bet.find({suggestion: true}).exec();
        else if (process.argv[2])
            bets = yield Bet.find({category: process.argv[2],
                                   suggestion: false}).exec();
        else
            bets = yield Bet.find().exec();
        console.log('Bets:', bets);
        process.exit();
    }
    catch(err){
        console.log('Error', err);
        process.exit();
    }
});
