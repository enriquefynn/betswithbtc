var router = require('koa-router');
var co = require('co');
var redis = new require('koa-redis')();
var captchagen = require('captchagen');
var io = require('./io');
var BetModel = require('mongoose').model('Bet');

redis.on('connect', function() {
    console.log('Redis client Connected');
});

module.exports = function (app, config){
    var publicRoute = new router();
    var socket = new io(app, config);

    publicRoute.get('/bets', function*(next){
        var category = this.request.query.category;
        var size = this.request.query.size;
        var sort_by = this.request.query.sort_by;
        var asc = this.request.query.asc;
        var number = this.request.query.page;
        try{
            this.body = yield BetModel.searchBetsBySport(category, sort_by, asc, size, number);
            this.status = 200;
        }
        catch(error){
            console.error(error);
            this.status = 400;
        }
    });

    publicRoute.get('/bet', function*(next){
        var id = this.request.query.id;
        try{
            this.body = yield BetModel.searchBetById(id);
            this.status = 200;
        }
        catch(error){
            console.error(error);
            this.status = 400;
        }
    });

    publicRoute.get('/captcha', function*(next){
        try{
            var captcha = captchagen.create();
            var clientSavedInfo = yield redis.get(this.request.ip);
            captcha.generate();
            if (clientSavedInfo === null || 
                clientSavedInfo === undefined)
                clientSavedInfo = {'captcha': captcha.text()};
            else
                clientSavedInfo.captcha = captcha.text();
            yield redis.set(this.request.ip, clientSavedInfo);
            this.body = captcha.uri();
        }
        catch(err){
            console.error(err);
        }
    });

    publicRoute.post('/suggest', function*(next){
        try{
            var captcha = this.request.body.captcha;
            var correctCaptcha = (yield redis.get(this.request.ip)).captcha;
            if (captcha === 'invalid' || captcha === undefined || captcha != correctCaptcha)
            {
                this.body = {error: 'Wrong Captcha'};
                this.status = 412;
                throw new Error('Wrong Captcha');
            }
            var suggestion = {suggestion: true};
            suggestion.category = this.request.body.category;
            suggestion.parts = [{name: this.request.body.team1}, {name: this.request.body.team2}];
            suggestion.website = this.request.body.website;
            if (!suggestion.category || !suggestion.parts[0].name ||
                !suggestion.parts[1].name || !suggestion.website)
            {
                this.status = 413;
                throw new Error('Some fields are incomplete');
            }
            var newBet = yield BetModel.addSuggestion(suggestion);

            //Send only the id and category to save bandwidth
            socket.newBet({id: newBet._id, category: newBet.category});
            this.body = newBet;
            this.status = 200;
        }
        catch(err){
            console.error(err);
        }
        finally{
            yield redis.set(this.request.ip, {captcha: 'invalid'});
        }
    });

    publicRoute.post('/like', function*(next){
        try{
            var betId = this.request.body.id;
            var like = this.request.body.like;
            if (betId !== undefined && like === undefined)
            {
                this.status = 413;
                throw new Error('Some fields are incomplete');
            }
            var clientSavedInfo = yield redis.get(this.request.ip);
            if (clientSavedInfo === undefined)
                clientSavedInfo = {};
            if (clientSavedInfo.voted === undefined)
                clientSavedInfo.voted = {};
            if (clientSavedInfo.voted[betId])
            {
                //TODO: User may change vote, this is simple stuff to do :-P
                if (config.app.env !== 'development')
                {
                    this.status = 414;
                    throw new Error('liked');
                }
            }
            clientSavedInfo.voted[betId] = true;
            this.body = yield BetModel.like(betId, like);
            yield redis.set(this.request.ip, clientSavedInfo);
            socket.modBet({id: betId, like: like});
        }
        catch(err){
            console.error(err);
        }
    });
    app.use(publicRoute.middleware());
};

