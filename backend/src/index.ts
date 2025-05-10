import express, { Router } from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { Agent } from 'node:https';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import socketIOStream from 'socket.io-stream';

const app = express();
const http = createServer(app);
const io = new Server(http);

import { ALREADY_SUCH_FILE_OR_DIR, NO_SUCH_FILE_OR_DIR, NO_NODES, NO_PERMISSIONS } from './responses';
import { db, init } from './sql';
import { cleanPath, getNodes } from './utils';

const apiRouter = Router();
import filesRouter from './routers/files';
import nodesRouter from './routers/nodes';
import usersRouter from './routers/users';

import { APIResponse } from '../types';

const PANEL_PORT = parseInt(process.env.PANEL_PORT || '3000') || 3000;
const PANEL_MAX_SIZE = parseInt(process.env.PANEL_MAX_SIZE || '8') || 8;
const PANEL_FORCE_SPREADING = process.env.PANEL_FORCE_SPREADING && process.env.PANEL_FORCE_SPREADING.toLowerCase() === 'false' ? false : true;

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

io.use((socket: socketIOStream, next) => {
	const req = socket.handshake;
	req.originalUrl = '/';
	// @ts-expect-error TODO
	return sessionHandler(req, {}, next);
});
io.on('connection', (socket: socketIOStream) => {
	if (!socket.handshake.session.loggedin) return;

	const userID = socket.handshake.session.userID;
	socket.join(userID);

	socket.on('downloading', (value) => {
		return (socket.handshake.session.downloading = value);
	});

	socketIOStream(socket).on('upload', async (stream, data) => {
		if (!data || !data.size || !data.path || !data.name) return;
		if (!socket.handshake.session.permissions.file.includes(2)) return socket.nsp.to(userID).emit('error', NO_PERMISSIONS);

		const path = cleanPath(data.path);
		const name = data.name;
		const size = data.size;
		let received = Buffer.from('');
		let receivedAmount = 0;

		const exists = await db.prepare('SELECT DISTINCT(name) FROM files WHERE path = ? AND name = ?;').get([path, name]);
		if (exists) return socket.nsp.to(userID).emit('error', ALREADY_SUCH_FILE_OR_DIR);

		const nodes = await getNodes(true, false, false);
		if (!nodes || nodes.length == 0) return socket.nsp.to(userID).emit('error', NO_NODES);

		const fileID = uuidv4();
		await db.prepare('INSERT INTO files (id, name, path) VALUES (?,?,?);').run([fileID, name, path]);

		let loops = Math.ceil(size / 1000 / 1000 / PANEL_MAX_SIZE);
		if (PANEL_FORCE_SPREADING && loops < nodes.length) loops = nodes.length;

		const amountPerLoop = Math.floor(size / loops);
		const remaining = size % loops;

		let i = 0;

		stream.on('data', async (chunk) => {
			received = Buffer.concat([received, chunk]);
			receivedAmount += chunk.length;

			const percentage = (receivedAmount / size) * 100;
			socket.emit('upload-percentage', percentage.toFixed(1));

			if (received.length < amountPerLoop) return;
			const curloop = i;
			i++;

			const nodeForThisLoop = nodes[Math.floor(Math.random() * nodes.length)];
			const partID = uuidv4();

			const extra = curloop == loops - 1 ? remaining : 0;
			const rest = received.length - amountPerLoop - extra;
			const dataForThisLoop = rest == 0 ? received : received.slice(0, -rest);
			received = rest == 0 ? Buffer.from('') : received.slice(-rest);

			const workerData = { task: 'upload', dataForThisLoop, nodeForThisLoop, fileID, partID, curloop, loops, path, name };

			const worker = new Worker(join(__dirname, './worker.js'), { workerData });

			worker.on('message', (msg) => {
				if (msg.toUser) socket.nsp.to(userID).emit(msg.event, msg.data);
				else io.sockets.emit(msg.event, msg.data);
			});
			return;
		});
	});

	socket.on('download', async (data) => {
		if (!data.path || !data.name) return;
		if (!socket.handshake.session.permissions.file.includes(1)) return socket.nsp.to(userID).emit('error', NO_PERMISSIONS);

		if (socket.handshake.session.downloading) return socket.nsp.to(userID).emit('error', "You're already downloading a file!");
		socket.handshake.session.downloading = true;

		const path = cleanPath(data.path);
		const name = data.name;

		const file = await db.prepare('SELECT * FROM files WHERE path = ? AND name = ?;').get([path, name]);
		if (!file) return socket.nsp.to(userID).emit('error', NO_SUCH_FILE_OR_DIR);

		const parts = await db.prepare('SELECT * FROM parts WHERE file = ? ORDER BY i;').all(file.id);
		if (!parts || parts.length == 0) return socket.nsp.to(userID).emit('error', NO_SUCH_FILE_OR_DIR);

		const workerData = { task: 'download', parts, path, name };

		const worker = new Worker(join(__dirname, './worker.js'), { workerData });

		worker.on('message', (msg) => {
			if (msg.toUser) socket.nsp.to(userID).emit(msg.event, msg.data);
			else io.sockets.emit(msg.event, msg.data);
		});
		return;
	});

	socket.on('delete', async (data) => {
		if (!data.name) return;
		if (!socket.handshake.session.permissions.file.includes(4)) return socket.nsp.to(userID).emit('error', NO_PERMISSIONS);

		const path = cleanPath(data.path);
		const name = data.name;

		const file = await db.prepare('SELECT * FROM files WHERE path = ? AND name = ?;').get([path, name]);
		if (!file) return socket.nsp.to(userID).emit('error', NO_SUCH_FILE_OR_DIR);

		const parts = await db.prepare('SELECT * FROM parts WHERE file = ? ORDER BY i;').all(file.id);
		if (!parts || parts.length == 0) {
			await db.prepare('DELETE FROM files WHERE id = ?;').run([file.id]);
			socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} deleted`);
			return io.sockets.emit('reload', 'files');
		}

		const done: string[] = [];

		for (const [i, part] of parts.entries()) {
			const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([part.node]);

			const body = {
				id: part.id,
				key: node.ckey,
			};

			const agent = new Agent({
				ca: node.ca,
			});

			try {
				const res = await fetch(`https://${node.ip}:${node.port}/files/delete`, {
					method: 'POST',
					body: JSON.stringify(body),
					headers: { 'Content-Type': 'application/json' },
					agent,
				});

				const json = (await res.json()) as APIResponse;

				if (!json.success) {
					// TODO: mark as deleted, and try again later?
					return socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} (${i + 1}/${parts.length}) failed`);
				} else {
					await db.prepare('DELETE FROM parts WHERE id = ?;').run([part.id]);
					done.push(part.id);

					if (done.length == parts.length) {
						await db.prepare('DELETE FROM files WHERE id = ?;').run([file.id]);
						socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} deleted`);
						return io.sockets.emit('reload', 'files');
					}
				}
			} catch {
				return socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} (${i + 1}/${parts.length}) failed`);
			}
		}
	});
});

app
	.use(express.static(join(__dirname, '../../../frontend/dist'))) // Serve static files from the frontend
	.use(express.json({ limit: '100mb' }))
	.use(express.urlencoded({ limit: '100mb', extended: true }))
	.use(sessionHandler)
	.use((req, res, next) => {
		// @ts-expect-error TODO
		req.io = io;
		return next();
	})
	.use('/api', apiRouter)
	.get('*splat', (req, res) => {
		res.sendFile(join(__dirname, '../../../frontend/dist/index.html'));
	});

apiRouter.use('/users', usersRouter).use('/nodes', nodesRouter).use('/files', filesRouter);

init();
http.listen(PANEL_PORT, () => {
	console.log(`Server online on port ${PANEL_PORT}`);
});
