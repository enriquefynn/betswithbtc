'use strict';

var mongoose = require('mongoose');
var Q = require('bluebird');
var btc = require('bitcoin-address');

var Schema = mongoose.Schema;

var categorySchema = new Schema();
categorySchema.add({
    name: {type: String, unique: true},
    subcategories: [categorySchema]
});

function validator(val)
{
    return btc.validate(val);
}

var addressSchema = new Schema({
    address: {type: String, unique: true}//, validate: validator}
});

//addressSchema.set('autoIndex', false);

addressSchema.statics.add = function(addr){
    return this.create({address: addr});
};

addressSchema.statics.search = function(addr){
    return this.findOne({address: addr});
};

mongoose.model('Address', addressSchema);

/* Status:
 * Open
 * Closed
 * Paid
 */
var betSchema = new Schema({
	category: String,
    parts: [new Schema({name: String, address: String}, {_id: false})],
    //logo1: String,
    //logo2: String,
    date_begun: Date,
    date_over: Date,
    winner: String,
    website: String,
    suggestion: {type: Boolean, default: false},
    likes: {type: Number, default: 0},
    created_date: {type: Date, default: Date.now}
},
{
    toJSON: {
    transform: function (doc, ret, options){
        delete ret.__v;
        delete ret.website;
        delete ret.suggestion;
    }}
}
);

//betSchema.set('autoindex', false);

/**
 * Add a bet
 * sport
 * name1
 * name2
 * logo1
 * logo2
 * ending_date
 */
betSchema.statics.add = function(bet){
    var that = this;
    var addrs = [];
    var query_p = Q.defer();
    //Find and remove 2 promises addresses from address pool
    for (var i in bet.parts)
        addrs.push(_model_address.findOneAndRemove().exec());
    var addrs_p = Q.all(addrs);
    addrs_p
        .then(function(addr_list){
            bet.parts.map(function(data){
                data.address = addr_list.pop().address;
            });
            that.create(bet).then(function(bet, err){
                if (err)
                    query_p.reject(err);
                else
                    query_p.resolve(bet);
            });
        });
    return query_p.promise;
};

/*
 * The same as above but without depopulating our addresses
 */
betSchema.statics.addSuggestion = function(bet){
    return this.create(bet);
};

betSchema.statics.like = function(betId, like){
    return this.findByIdAndUpdate(betId, (like) ? {$inc: {likes: 1}} : 
            {$inc: {likes: -1}}).exec();
};

betSchema.statics.searchBetsBySport = function(category, sort_by, asc, page_size, page_number){
    var query;
    var sort = {}
    sort[sort_by] = (asc) ? 'asc' : 'desc';
    if (category === 'suggestion')
        query = this.find({suggestion: true});
    else if (category === 'all')
        query = this.find({suggestion: false});
    else
        query = this.find({category: category, suggestion: false});
    query.sort(sort);
    query.skip(page_size*page_number).limit(page_size);
    return query.exec();
}

betSchema.statics.searchBetById = function(id){
    return this.findById(id).exec();
}

mongoose.model('Bet', betSchema);
