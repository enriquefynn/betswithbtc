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
        var bet = yield Bet.findById(process.argv[2]).exec();
        bet.winner = process.argv[3];
        var canBeWinner = false;
        for (var i in bet.parts)
        {
            if (bet.parts[i].name === bet.winner)
                canBeWinner = true;
        }
        if (canBeWinner)
            bet.save(function(err, wbet){
                console.log('Winner added:', wbet);
                process.exit();
            });
        else
            throw new Error('Winner not there!');
    }
    catch(err){
        console.log('Error', err);
        process.exit();
    }
});
