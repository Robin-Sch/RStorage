import { Router } from 'express';

import { db } from '../sql';
import { cleanPath } from '../utils';
import { NO_PERMISSIONS, NOT_LOGGED_IN, SUCCESS } from '../responses';

const filesRouter = Router();
filesRouter.get('/', async (req, res) => {
	if (!req.session.loggedin) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });
	if (!req.session.permissions.file.includes(1)) return res.status(403).json({ message: NO_PERMISSIONS, success: false });

	const path = cleanPath(req.query.path);

	const files = (await db.prepare('SELECT DISTINCT(name) FROM files WHERE path = ?;').all([path])) || [];
	// TODO AND NOT path like "?%" or something like that?
	const directories = (await db.prepare('SELECT DISTINCT(path) FROM files WHERE NOT path = ?;').all([path])) || [];

	const data = {
		path,
		files,
		directories,
	};

	return res.status(200).json({ data, message: SUCCESS, success: true });
});

export default filesRouter;
