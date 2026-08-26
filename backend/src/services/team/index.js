const shared = require('./shared');
const player = require('./player');
const manager = require('./manager');

module.exports = {
  ...shared,
  ...player,
  ...manager,
};
