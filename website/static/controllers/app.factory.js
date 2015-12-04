var app = angular.module('app.factory', []);

app.factory('betsFac', ['$http', function($http) {
    //TODO: Paginate
    return{
        getBet: function(betId){
            return $http({method: 'GET', url: 'http://127.0.0.1:8000/bet?id=' + betId});
        },
        getBets: function(category){
            return $http({method: 'GET', url: 'http://127.0.0.1:8000/bets?category='+ category + '&size=30' + '&limit=15'});
        },
        likeBet: function(betId, like){
            return $http({method: 'POST', url: 'http://127.0.0.1:8000/like', data: {id: betId, like: like}});
        }
    }
}]);

app.factory('getBCTransactions', ['$http', function($http) {
    return{
        //TODO: Paginate
        getTransactions: function(address){
            return $http({method: 'GET', url: 'https://blockchain.info/address/' + address + '?format=json'});
        },
        getUnspent: function(addressList){
            var url = 'https://blockchain.info/multiaddr?active=' + addressList[0];
            for (var i = 1; i < addressList.length; ++i)
                url = url + '|' + addressList[i];
            return $http({method: 'GET', url: url});
        }
    }
}]);

app.factory('getCaptcha', ['$http', function($http) {
    return function(category){
        return $http({method: 'GET', url: 'http://127.0.0.1:8000/captcha'});
    }
}]);

app.factory('postSuggestion', ['$http', function($http) {
    return function(suggestion){
        return $http({method: 'POST', url: 'http://127.0.0.1:8000/suggest', data: suggestion});
        }
}]);

app.factory('socket', ['$rootScope', function($rootScope){
    var socket = io('http://localhost:3000');
    return {
        on: function(eventName, callback){
            socket.on(eventName, function(){  
                var args = arguments;
                $rootScope.$apply(function(){
                    callback.apply(socket, args);
                });
            });
        },
        emit: function(eventName, data){
            socket.emit(eventName, data);
        }
    }
}]);

