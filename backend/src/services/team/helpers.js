const { randomBytes } = require('crypto');
const Team = require('../../models/Team');

const generateInviteCode = () => randomBytes(4).toString('hex').toUpperCase();

const generateUniqueSlug = async (base, excludeId) => {
  let slug = base;
  let counter = 0;
  for (;;) {
    const q = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
    const exists = await Team.exists(q);
    if (!exists) return slug;
    slug = `${base}-${++counter}`;
  }
};

module.exports = { generateInviteCode, generateUniqueSlug };
