const { calculateElo } = require('../../src/utils/elo');

describe('calculateElo', () => {
  it('hai đội ngang cơ: thắng được +16, thua mất 16', () => {
    const { newA, newB, changeA, changeB } = calculateElo(1200, 1200, 'requester');
    expect(changeA).toBe(16);
    expect(changeB).toBe(-16);
    expect(newA).toBe(1216);
    expect(newB).toBe(1184);
  });

  it('hai đội ngang cơ hoà thì điểm không đổi', () => {
    const { changeA, changeB } = calculateElo(1200, 1200, 'draw');
    expect(changeA).toBe(0);
    expect(changeB).toBe(0);
  });

  it('thắng đội yếu hơn được ít điểm hơn thắng đội mạnh hơn', () => {
    const thangDoiYeu = calculateElo(1600, 1200, 'requester').changeA;
    const thangDoiManh = calculateElo(1200, 1600, 'requester').changeA;
    expect(thangDoiYeu).toBeLessThan(thangDoiManh);
    expect(thangDoiYeu).toBeGreaterThan(0);
  });

  it('điểm cộng của bên này bằng điểm trừ của bên kia', () => {
    const { changeA, changeB } = calculateElo(1450, 1310, 'opponent');
    expect(changeA + changeB).toBe(0);
  });

  it('hoà với đội mạnh hơn thì được cộng điểm', () => {
    expect(calculateElo(1200, 1600, 'draw').changeA).toBeGreaterThan(0);
  });

  it('không tụt xuống dưới sàn 100 điểm', () => {
    const { newB } = calculateElo(2000, 100, 'requester');
    expect(newB).toBe(100);
  });
});
