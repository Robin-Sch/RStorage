import { Router } from 'express';

import { db } from '../sql';
import { cleanPath } from '../utils';
import { NO_PERMISSIONS, NOT_LOGGED_IN, SUCCESS } from '../responses';
import { APIFilesResponse, APIResponse } from '../../types';

const filesRouter = Router();
filesRouter.get('/', async (req, res) => {
	if (!req.session.loggedin) {
		res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
		return;
	}
	if (!req.session.permissions?.file.includes(1)) {
		res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
		return;
	}

	const path = cleanPath(req.query.path);

	const files = (await db.prepare('SELECT DISTINCT(name) FROM files WHERE path = ?;').all([path])) || [];
	// TODO AND NOT path like "?%" or something like that?
	const directories = (await db.prepare('SELECT DISTINCT(path) FROM files WHERE NOT path = ?;').all([path])) || [];

	res.status(200).json(<APIFilesResponse>{ files, directories, message: SUCCESS, success: true });
});

export default filesRouter;
