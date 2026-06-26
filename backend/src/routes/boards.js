import express from 'express';
import {
  getBoards,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
} from '../controllers/board-controller.js';

const router = Router();

function Router() {
  const r = express.Router();
  r.get('/', getBoards);
  r.get('/:id', getBoardById);
  r.post('/', createBoard);
  r.put('/:id', updateBoard);
  r.delete('/:id', deleteBoard);
  return r;
}

export default Router();
