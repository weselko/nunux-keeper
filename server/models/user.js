var logger = require('../helpers').logger,
    when   = require('when');

/**
 * Document object model.
 */
module.exports = function(db) {

  var UserSchema = new db.Schema({
    uid: { type: String, index: { unique : true } },
    username: { type: String },
    date: { type: Date, default: Date.now }
  });

  UserSchema.static('login', function(user) {
    var self = this;
    var autoGrantAccess = process.env.APP_AUTO_GRANT_ACCESS !== 'false';
    var query = this.findOne().where('uid').equals(user.uid);

    var logged = query.exec().then(function(_user) {
      if (_user) {
        // Return the user.
        logger.info('User %s authorized.', _user.uid);
        return when.resolve(_user);
      } else if (autoGrantAccess) {
        // Create the user.
        logger.info('User %s authorized. Will be created.', user.uid);
        return self.create(user);
      } else {
        // User not found and auto grant access is disabled.
        logger.warn('User %s not authorized.', user.uid);
        return when.reject('ENOTAUTHORIZED');
      }
    });

    return logged;
  });

  return db.model('User', UserSchema);
};
