const Field = require('../../models/Field');

/** Tách public_id của Cloudinary từ URL ảnh đã upload. */
const publicIdFromUrl = (url) => {
  const m = url.match(/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/);
  return m ? m[1] : null;
};

const generateUniqueSlug = async (base, excludeId) => {
  let slug = base;
  let counter = 0;
  for (;;) {
    const q = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
    const exists = await Field.exists(q);
    if (!exists) return slug;
    slug = `${base}-${++counter}`;
  }
};

module.exports = { publicIdFromUrl, generateUniqueSlug };
