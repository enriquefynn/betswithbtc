'use strict';
var path = require('path');
var _ = require('lodash');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var base = {
    app: {
        root: path.normalize(__dirname + '/..'),
        env: env
    }
};

var specific = {
    development: {
        app: {
            port: 8000,
            websocketPort: 3000,
            name: '1o1Bets Devel'
        },
        mongo: {
            url: 'mongodb://localhost/bets-dev',
        },
    },
    test: {
        app: {
            port: 8000,
            websocketPort: 3000,
            name: '1o1Bets Tests'
        },
        mongo: {
            url: 'mongodb://localhost/bets-test',
        },
    },
    production: {
        app: {
            port: process.env.PORT || 3000,
            websocketPort: 3010,
            name: '1o1Bets Production'
        },
        mongo: {
            url: 'mongodb://localhost/bets'
        },
    }
};
module.exports = _.merge(base, specific[env]);
