const K = 32;

const expectedScore = (ratingA, ratingB) => 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

/**
 * Tính ELO mới sau trận đấu.
 * @param {number} ratingA - ELO đội A (requester)
 * @param {number} ratingB - ELO đội B (opponent)
 * @param {'requester'|'opponent'|'draw'} winner
 * @returns {{ newA: number, newB: number, changeA: number, changeB: number }}
 */
const calculateElo = (ratingA, ratingB, winner) => {
  const expA = expectedScore(ratingA, ratingB);
  const expB = expectedScore(ratingB, ratingA);

  let scoreA, scoreB;
  if (winner === 'requester') { scoreA = 1; scoreB = 0; }
  else if (winner === 'opponent') { scoreA = 0; scoreB = 1; }
  else { scoreA = 0.5; scoreB = 0.5; }

  const changeA = Math.round(K * (scoreA - expA));
  const changeB = Math.round(K * (scoreB - expB));

  return {
    newA: Math.max(100, ratingA + changeA),
    newB: Math.max(100, ratingB + changeB),
    changeA,
    changeB,
  };
};

module.exports = { calculateElo };
