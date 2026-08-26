const overview = require('./overview');
const owners = require('./owners');
const moderation = require('./moderation');

module.exports = {
  ...overview,
  ...owners,
  ...moderation,
};
