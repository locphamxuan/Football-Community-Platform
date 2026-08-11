/**
 * Token thật, ký bằng đúng secret của test — không mock `authenticate`, để các
 * test route đi qua trọn vẹn chuỗi middleware như production.
 */
const { generateAccessToken } = require('../../src/utils/jwt');
const Role = require('../../src/constants/roles');

// ObjectId hợp lệ, cần khi service (đã mock) hoặc mongoose ép kiểu tham số.
const USER_ID = '000000000000000000000001';

const tokenFor = (...roles) => generateAccessToken(USER_ID, 'probe@example.com', roles).token;

/** Header Authorization cho một user mang đúng những role truyền vào. */
const asRole = (...roles) => ({ Authorization: `Bearer ${tokenFor(...roles)}` });

const asUser = () => asRole(Role.USER);
const asOwner = () => asRole(Role.USER, Role.FIELD_OWNER);
const asManager = () => asRole(Role.USER, Role.TEAM_MANAGER);
const asAdmin = () => asRole(Role.USER, Role.ADMIN);

module.exports = { USER_ID, tokenFor, asRole, asUser, asOwner, asManager, asAdmin };
