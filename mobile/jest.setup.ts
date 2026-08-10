// Mỗi test tự mock global.fetch, đây chỉ là mốc an toàn để không gọi mạng thật.
beforeEach(() => {
  global.fetch = jest.fn().mockRejectedValue(new Error('fetch chưa được mock trong test này')) as unknown as typeof fetch;
});
