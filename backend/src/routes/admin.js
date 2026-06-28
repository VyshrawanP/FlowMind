import express from 'express';
import { getMetrics, getUsersList, updateUserRole, deleteUser } from '../controllers/admin-controller.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Apply auth protection & admin authorization globally to this router
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/metrics', getMetrics);
router.get('/users', getUsersList);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

export default router;
