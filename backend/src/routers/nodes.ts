import { Router } from 'express';
import { Agent } from 'https';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../sql';
import { APINodeResponse, APIRequestError, APIResponse } from '../types';
import { connectToNode, randomString } from '../utils';

const nodesRouter = Router();

nodesRouter
	.get('/', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.node.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const data = await db.prepare('SELECT id, ip, port, ca FROM nodes;').all();
			res.status(200).json(<APIResponse>{ nodes: data, message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.get('/:id', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.node.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const node = await db.prepare('SELECT id, ip, port, ca FROM nodes WHERE id = ?;').get([req.params.id]);
			if (!node) throw new APIRequestError(400, { message: 'No node with that ID found!', success: false });

			// TODO: fetch if connected or not
			res.status(200).json(<APINodeResponse>{ node, message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.put('/:id', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.node.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const { ip, port, ca, force } = req.body;
			if (!ip || !port || !ca) throw new APIRequestError();

			const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([req.params.id]);
			if (!node) throw new APIRequestError(400, { message: 'No node with that ID found!', success: false });

			const body = {
				key: node.ckey,
			};

			const agent = new Agent({
				ca: node.ca,
			});

			try {
				const status = await connectToNode(ip, port, ca, node.ckey);
				if (!status.success && !force)
					throw new APIRequestError(500, { message: 'There are problems connecting to the node (with new config), please try again!', success: false });

				await fetch(`https://${node.ip}:${node.port}/deinit`, {
					method: 'POST',
					body: JSON.stringify(body),
					headers: { 'Content-Type': 'application/json' },
					agent,
				});

				await db.prepare('UPDATE nodes SET ip = ?, port = ?, ca = ? WHERE id = ?').run([ip, port, ca, req.params.id]);
				res.status(200).json(<APIResponse>{ message: '', success: true });
			} catch (e) {
				console.error(e);
				if (force) {
					await db.prepare('UPDATE nodes SET ip = ?, port = ?, ca = ? WHERE id = ?').run([ip, port, ca, req.params.id]);

					res.status(200).json(<APIResponse>{ message: '', success: true });
					return;
				}

				throw new APIRequestError(500, { message: 'There are problems connecting to the node (with old config), please try again!', success: false });
			}
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.delete('/:id', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.node.includes(4))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			// TODO
			// const { force } = req.body;
			const force = false;

			const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([req.params.id]);
			if (!node) throw new APIRequestError(400, { message: 'No node with that ID found!', success: false });

			const body = {
				key: node.ckey,
			};

			const agent = new Agent({
				ca: node.ca,
			});

			try {
				await fetch(`https://${node.ip}:${node.port}/deinit`, {
					method: 'POST',
					body: JSON.stringify(body),
					headers: { 'Content-Type': 'application/json' },
					agent,
				});

				await db.prepare('DELETE FROM nodes WHERE id = ?;').run([req.params.id]);
				res.status(200).json(<APIResponse>{ message: '', success: true });
			} catch (e) {
				console.error(e);

				if (force) {
					await db.prepare('DELETE FROM nodes WHERE id = ?;').run([req.params.id]);

					res.status(200).json(<APIResponse>{ message: '', success: true });
					return;
				}

				throw new APIRequestError(500, { message: 'There are problems connecting to the node, please try again!', success: false });
			}
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/create', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.node.includes(2))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const { ip, port, ca } = req.body;
			if (!ip || !port || !ca) throw new APIRequestError();

			const key = randomString(32);
			const ckey = randomString(1280);

			const status = await connectToNode(ip, port, ca, ckey);
			if (status.success == false) throw new APIRequestError(400, status);

			await db.prepare('INSERT INTO nodes (id, ip, port, ca, key, ckey) VALUES (?,?,?,?,?,?);').run([uuidv4(), ip, port, ca, key, ckey]);
			res.status(200).json(<APIResponse>{ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	});

export default nodesRouter;
