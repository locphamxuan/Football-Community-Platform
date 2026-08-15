jest.mock('../../src/models/User', () => ({ findByIdAndUpdate: jest.fn(), find: jest.fn() }));
jest.mock('../../src/config/cloudinary', () => ({
  uploadImage: jest.fn(), deleteImage: jest.fn(),
}));

const User = require('../../src/models/User');
const userService = require('../../src/services/user.service');
const { NotificationType } = require('../../src/constants/notifications');

const USER_ID = '000000000000000000000001';

beforeEach(() => {
  User.findByIdAndUpdate.mockResolvedValue({ _id: USER_ID });
  User.find.mockReturnValue({ select: () => ({ limit: () => Promise.resolve([]) }) });
});

describe('searchChatPartners', () => {
  const filterOf = () => User.find.mock.calls[0][0];

  it('bỏ chính mình, tài khoản bị khoá và quản trị viên ra khỏi kết quả', async () => {
    await userService.searchChatPartners(USER_ID, { q: 'nam' });

    expect(filterOf()).toMatchObject({
      _id: { $ne: USER_ID },
      status: 'active',
      roles: { $ne: 'admin' },
    });
  });

  it('ký tự đặc biệt là chữ cần tìm, không phải cú pháp regex', async () => {
    await userService.searchChatPartners(USER_ID, { q: 'a.*' });

    const [byName] = filterOf().$or;
    expect('aXYZ').not.toMatch(byName.fullName);
    expect('a.*b').toMatch(byName.fullName);
  });
});

describe('updateNotificationPrefs', () => {
  it('ghi công tắc đẩy bằng đường dẫn có dấu chấm — gửi cả cụm sẽ xoá mất mutedTypes', async () => {
    await userService.updateNotificationPrefs(USER_ID, { push: false });

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { 'notifications.push': false },
      expect.objectContaining({ new: true })
    );
  });

  it('ghi danh sách loại đã tắt mà không đụng tới công tắc đẩy', async () => {
    const mutedTypes = [NotificationType.INVOICE_ISSUED];

    await userService.updateNotificationPrefs(USER_ID, { mutedTypes });

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { 'notifications.mutedTypes': mutedTypes },
      expect.anything()
    );
  });

  it('bật lại hết bằng mảng rỗng — không nhầm thành "không gửi trường này"', async () => {
    await userService.updateNotificationPrefs(USER_ID, { mutedTypes: [] });

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { 'notifications.mutedTypes': [] },
      expect.anything()
    );
  });

  it('người dùng không còn tồn tại thì trả 404', async () => {
    User.findByIdAndUpdate.mockResolvedValue(null);

    await expect(userService.updateNotificationPrefs(USER_ID, { push: true }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
