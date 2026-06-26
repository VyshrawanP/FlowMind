import express from 'express';
import {
  getCards,
  inferCardComplexity,
  createCard,
  updateCard,
  deleteCard,
} from '../controllers/card-controller.js';

const router = express.Router();

router.get('/', getCards);
router.post('/infer-complexity', inferCardComplexity);
router.post('/', createCard);
router.put('/:id', updateCard);
router.delete('/:id', deleteCard);

export default router;
