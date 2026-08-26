const shared = require('./shared');
const owner = require('./owner');
const admin = require('./admin');

module.exports = {
  ...shared,
  ...owner,
  ...admin,
};
