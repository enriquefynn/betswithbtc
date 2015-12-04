'use strict';
var app = angular.module('app.betsCtrl', ['app.factory']);

app.controller('betsCtrl', ['$scope', '$rootScope', 'getBCTransactions', 'betsFac', 'socket', function($scope, $rootScope, getBCTransactions, betsFac, socket){
    //SOCKET
    socket.on('betmod', function(bet){
        var i;
        for (i = 0; i < $rootScope.currentBets.length; ++i)
        {
            if ($rootScope.currentBets[i]._id === bet.id)
            {
                (bet.like) ? ++$rootScope.currentBets[i].likes : 
                             --$rootScope.currentBets[i].likes
                break;
            }
        }
        //TODO: If bet is not there should require bet and add there
        //if in the same category
        if (i === $rootScope.currentBets.lenght)
            console.err('TODO');
    });

    socket.on('newbet', function(bet){
        //TODO: Add the bet only if in selected category === bet.category
        betsFac.getBet(bet.id).success(function(data){
            $rootScope.currentBets.unshift(data);
        });
    });


    this.addressList = [];
    this.addressAmmount = {};
    this.symbolCode = undefined;
    this.conversion = undefined;
    var that = this;

    function update(category){
        betsFac.getBets(category).success(function(bets){
            $rootScope.currentBets = bets;
            for (var i in bets)
                for (var j in bets[i].parts)
                    that.addressList.push(bets[i].parts[j].address);
            getBCTransactions.getUnspent(that.addressList).success(function(unspent){
                that.symbolCode = unspent.info.symbol_local.symbol;
                that.conversion = 100000000/unspent.info.symbol_local.conversion;

                for (var i in unspent.addresses)
                    that.addressAmmount[unspent.addresses[i].address] = unspent.addresses[i].total_received/100000000;
            });
        });
    };
    
    this.like = function(betId, like){
        betsFac.likeBet(betId, like);
    };

    update('suggestion');
}]);
