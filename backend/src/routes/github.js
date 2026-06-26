import express from 'express';
import { importGithubIssues } from '../controllers/github-controller.js';

const router = express.Router({ mergeParams: true });

router.post('/', importGithubIssues);

export default router;
