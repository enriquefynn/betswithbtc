var mongoose = require('mongoose');
var database = require('../database');
var Q = require('q');

mongoose.connect('mongodb://localhost/test-db');

describe("Bets Primitives", function(){
    beforeEach(function(done){
        database.model_bet.remove({}, function(){
            database.model_address.remove({}, function(){
                var query_p = Q.all([database.addAddress("1JsDJ8j5PwZU8kijZgRpZwW2EBZB4Xnw9M"), 
                database.addAddress("16GcxcPVmZyKiRap3hmY7u5fHkDKnAjduJ")]);
                query_p.then(function(){
                    done();
                });
            });
        });
    });
    it("Checks if address is there", function(done){
        var query_p = database.searchAddr("1JsDJ8j5PwZU8kijZgRpZwW2EBZB4Xnw9M");
        query_p.then(function(data){
            data.should.equal("1JsDJ8j5PwZU8kijZgRpZwW2EBZB4Xnw9M");
            done();
        })
        .done(null, function(err){
            done(err);
        });
    });

    it("Creates a new bet", function(done){
        var query_p = database.addBet({sport: "LOL", name1: "Eq1", 
            name2: "Eq2", logo1: "http://www.desgraca.com/ola.jpg",
            logo2: "http://www.desgraca.com/ols.jpg", ending_date: new Date()});
        query_p.then(function(bet){
            bet.sport.should.equal("LOL");
            bet.name1.should.equal("Eq1");
            bet.name2.should.equal("Eq2");
            bet.addr1.should.not.equal(null);
            bet.addr2.should.not.equal(null);
            bet.addr1.should.not.equal(bet.addr2);
            done();
        })
        .done(null, function(err){
            done(err);
        });             
    });
    
    it("Checks if error when invalid btc address", function(done){
        query_p = database.addAddress("invalid");
        query_p.then(null, function(err){
            err.should.not.equal(null);
            done();
        })
        .done(null, function(err){
            done(err);
        });
    });
    afterEach(function(done){
        database.model_bet.remove({}, function(){
            database.model_address.remove({}, function(){
                done();
            });
        });
    });
});

describe("Bets Operations", function(){
    beforeEach(function(done){
        var addrs = ["1JsDJ8j5PwZU8kijZgRpZwW2EBZB4Xnw9M", "16GcxcPVmZyKiRap3hmY7u5fHkDKnAjduJ",
        "1Fa7FUx1emGwCZG8n4Vb7Gd7Dc9Xi6k17q", "187iSS2sc4AmzbeL8hFsda9mZwTNDinbh",
        "19MavD2YCNRJeYHfu5HyZfPgVs3Q1xoJxz", "134BqrzwHw6QHfipksBuLisyyPS1hniKyx",
        "1JTGTAm3fnbRYM43QCcQoEamwACr1p1azo", "1GbXEVbUdEzrTgHZ2ehyQpJAaF8CWsVgUL",
        "16phue1Dnftmk9ykKF4xFadAqaor85o5D6", "1FE4Y7qnfE35tZLv3xVYS1fWzWWWTpVpDU",
        "14bttjkGshFc34TowAd6nDmZPHQBoCEW2c", "13E4cLL998o85hN96g1nUP952Lk3bkKFvo"];
        var bets = [];
        for (var i = 0; i < 6; ++i)
        {
            b = {};
            b.sport = "LOL";
            b.name1 = "Eq" + i;
            b.name2 = "Eq" + (i+6);
            b.logo1 = "http://www.desgraca.com/" + i + ".jpg";
            b.logo2 = "http://www.desgraca.com/" + (i+6) + ".jpg";
            if (i < 2)
                b.featured = true;
            b.ending_date = new Date(Math.floor(Math.random() * (2000000000000)));
            bets.push(b);
        }
        database.model_bet.remove({}, function(){
            database.model_address.remove({}, function(){
                var queriesAddr_p = [];
                for (var i in addrs)
                    queriesAddr_p.push(database.addAddress(addrs[i]));
                var query_p = Q.all(queriesAddr_p);
                query_p.then(function(){
                    var queriesBets_p = [];
                    for (var i in bets)
                        queriesBets_p.push(database.addBet(bets[i]));
                    var query2_p = Q.all(queriesBets_p);
                    query2_p.then(function(){
                        done();
                    });
                })
            });
        });
    });

    it("Checks if all bets in pagination are ordered", function(done){
        var query_p = Q.all([database.searchOpenBetsBySport("LOL", 2, 0),
            database.searchOpenBetsBySport("LOL", 2, 1),
            database.searchOpenBetsBySport("LOL", 2, 2)]);
        query_p.then(function(bets){
            var date_cmp = new Date(bets[0][0].ending_date);
            for (var i = 0; i < 3; ++i)
                for (var j = 0; j < 2; ++j)
                {
                    bets[i][j].sport.should.equal("LOL");
                    var some_date = new Date(bets[i][j].ending_date);
                    (date_cmp <= some_date).should.be.ok;
                    date_cmp = some_date;
                }
            done();
        })
        .done(null, function(err){
            done(err);
        });
    });

    it("Checks closing/resolving a bet", function(done){
        var query_p = database.closeBet("1JsDJ8j5PwZU8kijZgRpZwW2EBZB4Xnw9M", 
                                        "16GcxcPVmZyKiRap3hmY7u5fHkDKnAjduJ");
        query_p.then(function(bet){
            bet.status.should.equal("Closed");
        })
        .then(function(){
            var addr1_p, addr2_p;
            var query2_p = database.payBet("16GcxcPVmZyKiRap3hmY7u5fHkDKnAjduJ",
                                      "1JsDJ8j5PwZU8kijZgRpZwW2EBZB4Xnw9M");
            query2_p.then(function(bet){
                addr1_p = database.searchAddr("16GcxcPVmZyKiRap3hmY7u5fHkDKnAjduJ");

                addr1_p.then(function(data){
                    data.should.equal("16GcxcPVmZyKiRap3hmY7u5fHkDKnAjduJ");
                    bet.status.should.equal("Paid");
                    done();
                })
                .done(null, function(err){
                    done(err);
                });

            })
        })
        .done(null, function(err){
            done(err);
        });
    });

    it("Checks featured bet", function(done){
        var query_p = database.searchOpenBetsBySport("featured", 10, 0);
        query_p.then(function(bet){
            bet[0].sport.should.equal("LOL");
            bet[1].sport.should.equal("LOL");
            done();
        })
        .done(null, function(err){
            done(err);
        });
    });

    afterEach(function(done){
        database.model_bet.remove({}, function(){
            database.model_address.remove({}, function(){
                done();
            });
        });
    });
});
