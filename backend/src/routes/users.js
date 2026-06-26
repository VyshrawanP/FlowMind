import express from 'express';
import { getUsers, createOrGetUser } from '../controllers/user-controller.js';

const router = express.Router();

router.get('/', getUsers);
router.post('/', createOrGetUser);

export default router;
