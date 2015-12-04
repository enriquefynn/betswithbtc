'use strict';
var app = angular.module('app.socketCtrl', []);

function socketConnection(addrs){
    var that = this;
    this.conn = new WebSocket('wss://ws.blockchain.info/inv');
    this.conn.onopen = function(){
        console.log('Connected', addrs);
        for (var i in addrs)
            that.conn.send('{"op":"addr_sub", "addr":"' + addrs[i] + '"}');
      };
    this.conn.onerror = function(error){
        console.log('websocket error:', error);
      }
    this.conn.onmessage = function(event){
        var msg = JSON.parse(event.data);
        console.log(event);
      }
    this.conn.onclose = function(){
        console.log('Connection Closed, reconnecting in 1s');
        setTimeout(function(){
            that = new socketConnection(addrs);
        }, 1000);
      }
}

app.controller('socketCtrl', ['$scope', function($scope){
    this.conn = new socketConnection(['1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY', '1MhvBQK1HyWFKezCCM6VN2TzcDcwWWMw4m']);
}]);
