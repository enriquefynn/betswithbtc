'use strict';
var app = angular.module('app.material',['ngMaterial', 'ngMessages', 'app.factory', 'app.betsCtrl']);

app.config(function($mdThemingProvider, $mdIconProvider){
    $mdThemingProvider.theme('default')
    .primaryPalette('indigo')
    .accentPalette('blue');
    $mdIconProvider
    .icon("menu",       "./static/icons/menu.svg", 24)
    .icon("thumbsup",   "./static/icons/thumbsup.svg", 24)
    .icon("thumbsdown", "./static/icons/thumbsdown.svg", 24)
});

app.controller('materialCtrl', ['$scope', '$mdSidenav', '$mdBottomSheet', '$mdDialog', '$rootScope', 'getCaptcha', 'postSuggestion', '$q', 
        function($scope, $mdSidenav, $mdBottomSheet, $mdDialog, $rootScope, getCaptcha, postSuggestion, $q){
    var that = this;
    this.showAddSuggestion = function(ev){
        $mdDialog.show({
            controller: DialogController,
            templateUrl: 'dialogAddSuggestion.html',
            targetEvent: ev
            });
    };

    this.toggleList = function(){
        var pending = $mdBottomSheet.hide() || $q.when(true);
        pending.then(function(){
            $mdSidenav('left').toggle();
        });
    };
    
    this.selectCategory = function(category){
        that.toggleList();
    };

    function DialogController($scope, $mdDialog) {
        $scope.captcha = undefined;
        $scope.hide = function(){
            $mdDialog.hide();
        };
        var that = this;

        this.getCaptchaF = function(){
            getCaptcha().success(function(data){
                $scope.captcha = data;
            });
        };
        this.getCaptchaF();

        $scope.addSuggestion = function(suggestion){
            postSuggestion(suggestion).success(function(data){
                $scope.wrongCaptcha = false; 
                //$rootScope.currentBets.unshift(data);
                $scope.hide();
            }).
            error(function(data, status, headers, config){
                if (status === 412)
                {
                    that.getCaptchaF();
                    $scope.wrongCaptcha = true;
                    suggestion.captcha = '';
                }
                else
                    $scope.wrongCaptcha = false; 
            });
        };
    };
}]);
