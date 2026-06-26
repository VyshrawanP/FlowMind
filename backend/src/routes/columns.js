import express from 'express';
import {
  getColumns,
  createColumn,
  updateColumn,
  deleteColumn,
} from '../controllers/column-controller.js';

const router = express.Router();

router.get('/', getColumns);
router.post('/', createColumn);
router.put('/:id', updateColumn);
router.delete('/:id', deleteColumn);

export default router;
