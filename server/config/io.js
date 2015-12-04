'use strict';
var co = require('co');

var IO = function(app, config){
    this.websocketServer = require('http').createServer(app.callback());
    this.io = require('socket.io')(this.websocketServer);
    try{
        this.io.on('connection', function(socket){
            console.log('SOCKET.IO', 'User connected');
        })

        this.io.on('disconnect', function(){
            console.log('SOCKET.IO', 'User disconnected');
        });
        console.log('Listening Websocket on', config.app.websocketPort);
        this.websocketServer.listen(config.app.websocketPort);
    }
    catch(err){
        console.error('SOCKET.IO', 'Failed to init:', err);
    }
};

IO.prototype.newBet = function(bet){
    this.io.emit('newbet', bet);
};

IO.prototype.modBet = function(bet){
    this.io.emit('betmod', bet);
};

module.exports = IO;
