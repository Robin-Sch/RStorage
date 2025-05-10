import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { Agent } from 'https';

import { APINodeResponse, APIResponse } from '../../types';

import { PROBLEMS_CONNECTING_NODE, INVALID_BODY, INVALID_NODE, NO_PERMISSIONS, SUCCESS, NOT_LOGGED_IN } from '../responses';
import { db } from '../sql';
import { connectToNode, randomString } from '../utils';

const nodesRouter = Router();

nodesRouter
	.get('/', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.node.includes(1)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const data = await db.prepare('SELECT id, ip, port, ca FROM nodes;').all();
		res.status(200).json(<APIResponse>{ nodes: data, message: SUCCESS, success: true });
	})
	.get('/:id', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.node.includes(1)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const node = await db.prepare('SELECT id, ip, port, ca FROM nodes WHERE id = ?;').get([req.params.id]);
		if (!node) {
			res.status(400).json(<APIResponse>{ message: INVALID_NODE, success: false });
			return;
		}

		// TODO: fetch if connected or not
		res.status(200).json(<APINodeResponse>{ node, message: SUCCESS, success: true });
	})
	.put('/:id', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.node.includes(1)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const { ip, port, ca, force } = req.body;
		if (!ip || !port || !ca) {
			res.status(400).json(<APIResponse>{ message: INVALID_BODY, success: false });
			return;
		}

		const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([req.params.id]);
		if (!node) {
			res.status(400).json(<APIResponse>{ message: INVALID_NODE, success: false });
			return;
		}

		const body = {
			key: node.ckey,
		};

		const agent = new Agent({
			ca: node.ca,
		});

		try {
			const status = await connectToNode(ip, port, ca, node.ckey);
			if (!status.success && !force) {
				res.status(500).json(<APIResponse>{ message: PROBLEMS_CONNECTING_NODE + ' (with new config)', success: false });
				return;
			}

			await fetch(`https://${node.ip}:${node.port}/deinit`, {
				method: 'POST',
				body: JSON.stringify(body),
				headers: { 'Content-Type': 'application/json' },
				agent,
			});

			await db.prepare('UPDATE nodes SET ip = ?, port = ?, ca = ? WHERE id = ?').run([ip, port, ca, req.params.id]);
			res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
		} catch (e) {
			console.error(e);
			if (force) {
				await db.prepare('UPDATE nodes SET ip = ?, port = ?, ca = ? WHERE id = ?').run([ip, port, ca, req.params.id]);

				res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
				return;
			}

			res.status(500).json(<APIResponse>{ message: PROBLEMS_CONNECTING_NODE + ' (with old config)', success: false });
		}
	})
	.delete('/:id', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.node.includes(4)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		// TODO
		// const { force } = req.body;
		const force = false;

		const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([req.params.id]);
		if (!node) {
			res.status(400).json(<APIResponse>{ message: INVALID_NODE, success: false });
			return;
		}

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
			res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
		} catch (e) {
			console.error(e);

			if (force) {
				await db.prepare('DELETE FROM nodes WHERE id = ?;').run([req.params.id]);

				res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
				return;
			}

			res.status(500).json(<APIResponse>{ message: PROBLEMS_CONNECTING_NODE, success: false });
		}
	})
	.post('/create', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.node.includes(2)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const { ip, port, ca } = req.body;
		if (!ip || !port || !ca) {
			res.status(400).json(<APIResponse>{ message: INVALID_BODY, success: false });
			return;
		}

		const key = randomString(32);
		const ckey = randomString(1280);

		const status = await connectToNode(ip, port, ca, ckey);
		if (status.success == false) {
			res.status(400).json(<APIResponse>status);
			return;
		}

		await db.prepare('INSERT INTO nodes (id, ip, port, ca, key, ckey) VALUES (?,?,?,?,?,?);').run([uuidv4(), ip, port, ca, key, ckey]);
		res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
	});

export default nodesRouter;
