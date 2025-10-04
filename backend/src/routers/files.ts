import { Router } from 'express';
import fetch from 'node-fetch';
import { Agent } from 'node:https';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../sql';
import { APIFilesResponse, APIRequestError, APIResponse, EncryptionStream } from '../types';
import { cleanPath, getNodes } from '../utils';

// const PANEL_MAX_SIZE = parseInt(process.env.PANEL_MAX_SIZE || '8') || 8;
// const PANEL_FORCE_SPREADING = process.env.PANEL_FORCE_SPREADING && process.env.PANEL_FORCE_SPREADING.toLowerCase() === 'false' ? false : true;

const filesRouter = Router();
filesRouter
	.get('/', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.file.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const path = cleanPath(req.query.path);

			const files = (await db.prepare('SELECT DISTINCT(name) FROM files WHERE path = ?;').all([path])) || [];
			// TODO AND NOT path like "?%" or something like that?
			const directories = (await db.prepare('SELECT DISTINCT(path) FROM files WHERE NOT path = ?;').all([path])) || [];

			res.status(200).json(<APIFilesResponse>{ files, directories, message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/upload', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.file.includes(2))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const name = req.headers['x-filename']?.toString();
			const size = Number(req.headers['x-size']) || 0;
			if (!name || size === 0) throw new APIRequestError();

			const path = cleanPath(req.query.path);
			const exists = await db.prepare('SELECT DISTINCT(name) FROM files WHERE path = ? AND name = ?;').get([path, name]);
			if (exists) throw new APIRequestError(400, { message: 'That file or directory does already exists!', success: false });

			const nodes = await getNodes(true, false, false);
			if (!nodes || nodes.length == 0) throw new APIRequestError(400, { message: 'There are no nodes connected!', success: false });

			const fileID = uuidv4();
			await db.prepare('INSERT INTO files (id, name, path) VALUES (?,?,?);').run([fileID, name, path]);

			// TODO: for now we upload whole file to a single node (no splitting)
			const partID = uuidv4();
			const node = nodes[Math.floor(Math.random() * nodes.length)];

			// TODO: send as websocket
			console.log(`[upload] [server-side] ${path}${name} encrypting`);

			const inputStream = new ReadableStream({
				async start(controller) {
					req.on('data', (chunk) => controller.enqueue(chunk));
					req.on('end', () => controller.close());
					req.on('error', (err) => controller.error(err));
				},
			});
			const outputStream = inputStream.pipeThrough(new EncryptionStream(node.key));

			const agent = new Agent({
				ca: node.ca,
			});

			const uploadRes = await fetch(`https://${node.ip}:${node.port}/parts/upload`, {
				method: 'POST',
				duplex: 'half',
				headers: {
					'Content-Type': 'application/octet-stream',
					Authorization: node.ckey,
					'X-Filename': partID,
				},
				// @ts-expect-error Stream
				body: outputStream,
				agent,
			});
			const json = (await uploadRes.json()) as APIResponse;
			if (!json.success) {
				// TODO: delete all uploaded parts, and throw error?
				await db.prepare('DELETE FROM files WHERE id = ?;').run([fileID]);
				// TODO: send as websocket
				console.log(`[upload] [server-side] ${path}${name} failed`);
				throw new Error('Upload failed');
			} else {
				await db.prepare('INSERT INTO parts (id, file, node, iv, i) VALUES (?,?,?,?,?);').run([partID, fileID, node.id, 'a', 0]);
				// TODO: send as websocket
				console.log(`[upload] [server-side] ${path}${name} uploaded to node`);
				res.status(200).json({ message: '', success: true });
			}
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/delete', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.file.includes(4))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			if (!req.query || !req.query.path || !req.query.name) throw new APIRequestError();
			const path = cleanPath(req.query.path);
			const name = req.query.name;

			const { id: fileID } = await db.prepare('SELECT id FROM files WHERE path = ? AND name = ?;').get([path, name]);
			if (!fileID) throw new APIRequestError(400, { message: 'That file or directory does not exists!', success: false });

			const parts = await db.prepare('SELECT id, node FROM parts WHERE file = ?;').all([fileID]);

			let successful = true;
			for (const { id: partID, node: nodeID } of parts) {
				const { ip, port, ca, ckey } = await db.prepare('SELECT ip, port, ca, ckey FROM nodes WHERE id = ?;').get([nodeID]);

				const agent = new Agent({
					ca: ca,
				});

				const uploadRes = await fetch(`https://${ip}:${port}/parts/delete?id=${partID}`, {
					method: 'POST',
					headers: {
						Authorization: ckey,
					},
					agent,
				});
				const json = (await uploadRes.json()) as APIResponse;
				if (!json.success) {
					// TODO: send as websocket
					console.log(`[delete] [server-side] ${path}${name} failed`);
					console.log(json.message);
					successful = false;
				} else {
					await db.prepare('DELETE FROM parts WHERE id = ? AND file = ? AND node = ?').run([partID, fileID, nodeID]);
					// TODO: send as websocket
					console.log(`[delete] [server-side] ${path}${name} deleted from node`);
				}
			}

			if (successful) {
				await db.prepare('DELETE FROM files WHERE id = ?;').run([fileID]);
				res.status(200).json({ message: '', success: true });
			} else {
				// TODO, some parts are deleted, other parts are not...
				console.log('nope');
			}
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	});

export default filesRouter;
