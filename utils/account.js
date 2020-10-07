var request = require('request');
var config = require('../config.json');

class Account {
  static Exist(userId) {
    return new Promise((resolve) => {
      request.get({
        url: config.url + "api/users/exist",
        qs: { userId: userId }
      }, function(error, response, body) {
        if(body == "true") {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  static listGuild(userId) {
    return new Promise((resolve) => {
      request.get({
        url: config.url + "api/users/guilds/list",
        qs: { userId: userId, apiKey: config.apiKey }
      }, function(error, response, body) {
        try {
          var decodedBody = JSON.parse(body);
        } catch(e) {
          return resolve(false);
        }

        if(decodedBody.success) {
          return resolve(decodedBody.guildData);
        } else {
          return resolve(false);
        }

      });
    })
  }

  static getGuildData(userId, uuid) {
    return new Promise((resolve) => {
      request.get({
        url: config.url + "api/users/guilds/get",
        qs: { userId: userId, uuid: uuid, apiKey: config.apiKey }
      }, function(error, response, body) {
        try {
          var decodedBody = JSON.parse(body);
        } catch(e) {
          return resolve(false);
        }

        if(decodedBody.success) {
          return resolve(decodedBody.guildData);
        } else {
          return resolve(false);
        }

      });
    })
  }

}

module.exports = Account;