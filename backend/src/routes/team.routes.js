const { Router } = require('express');
const controller = require('../controllers/team.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { createTeamSchema, updateTeamSchema, updateMemberSchema, joinTeamSchema } = require('../validations/team.validation');

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', controller.getTeams);
router.get('/:id', controller.getTeamById);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/me/my-teams', controller.getMyTeams);
router.post('/',
  uploadLimiter, uploadSingle, validate(createTeamSchema),
  controller.createTeam
);
router.patch('/:id',
  uploadLimiter, uploadSingle, validate(updateTeamSchema),
  controller.updateTeam
);
router.delete('/:id', controller.deleteTeam);

// ── Join / Leave ──────────────────────────────────────────────────────────────
router.post('/:id/join', validate(joinTeamSchema), controller.joinTeam);
router.post('/:id/leave', controller.leaveTeam);

// ── Members management ────────────────────────────────────────────────────────
router.delete('/:id/members/:memberId', controller.removeMember);
router.patch('/:id/members/:memberId', validate(updateMemberSchema), controller.updateMember);

// ── Invite code ───────────────────────────────────────────────────────────────
router.post('/:id/invite-code/regenerate', controller.regenerateInviteCode);

module.exports = router;
