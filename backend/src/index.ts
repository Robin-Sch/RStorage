import express, { Router } from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { join } from 'node:path';

const app = express();
const http = createServer(app);

import { init } from './sql';

const apiRouter = Router();
import filesRouter from './routers/files';
import nodesRouter from './routers/nodes';
import usersRouter from './routers/users';

const PANEL_PORT = parseInt(process.env.PANEL_PORT || '3000') || 3000;

const SECRET = randomBytes(16);
const sessionHandler = session({
	secret: SECRET,
	resave: true,
	saveUninitialized: true,
});

declare module 'express-session' {
	interface SessionData {
		loggedin: boolean;
		userID: string;
		username: string;
		permissions: {
			file: number[];
			node: number[];
			user: number[];
		};
	}
}

app
	.use(express.static(join(__dirname, '../../../frontend/dist'))) // Serve static files from the frontend
	.use(express.json({ limit: '100mb' }))
	.use(express.urlencoded({ limit: '100mb', extended: true }))
	.use(sessionHandler)
	.use('/api', apiRouter)
	.get('*splat', (req, res) => {
		res.sendFile(join(__dirname, '../../../frontend/dist/index.html'));
	});

apiRouter.use('/users', usersRouter).use('/nodes', nodesRouter).use('/files', filesRouter);

init();
http.listen(PANEL_PORT, () => {
	console.log(`Server online on port ${PANEL_PORT}`);
});
