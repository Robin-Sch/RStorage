import { randomBytes } from 'crypto';
import { Agent } from 'node:https';
import fetch from 'node-fetch';

import { db, init } from './sql';
import { APIResponse, Node } from './types';

// TODO: replace with some existing module?
export const cleanPath = (path) => {
	if (!path) path = '/';
	if (!path.startsWith('/')) path = `/${path}`;
	if (!path.endsWith('/')) path = `${path}/`;

	return path;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const randomString = (length: number): string => {
	const maxByte = 256 - (256 % ALPHABET.length);
	let result = '';

	while (result.length < length) {
		const buf = randomBytes(length - result.length);
		for (let i = 0; i < buf.length; i++) {
			if (buf[i] < maxByte) {
				result += ALPHABET.charAt(buf[i] % ALPHABET.length);
			}
		}
	}

	return result;
};

export const connectToNode = async (ip, port, ca, ckey): Promise<APIResponse> => {
	try {
		const body = {
			key: ckey,
		};

		const agent = new Agent({
			ca,
		});

		const controller = new AbortController();
		const signal = controller.signal;
		setTimeout(() => {
			controller.abort();
		}, 5000);

		const res = await fetch(`https://${ip}:${port}/init`, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' },
			agent,
			signal,
		});
		const json = (await res.json()) as APIResponse;

		if (!json.success) return { message: json.message, success: false };
		else return { message: 'Success!', success: true };
	} catch {
		return { message: 'There are problems connecting to the node, please try again!', success: false };
	}
};

export const getNodes = async (skipNotConnected, skipConnectionDetails, skipEncryptionKey): Promise<Node[]> => {
	const all = await db.prepare('SELECT * FROM nodes;').all();
	const nodes: Node[] = [];

	if (!all || all.length == 0) return nodes;

	for (const node of all) {
		const status = await connectToNode(node.ip, node.port, node.ca, node.ckey);
		if (skipNotConnected && !status.success) continue;

		// @ts-expect-error TODO
		const obj: Node = {
			id: node.id,
			connected: status.success,
		};

		if (!skipConnectionDetails) {
			obj.ip = node.ip;
			obj.port = node.port;
			obj.ca = node.ca;
			obj.ckey = node.ckey;
		}

		if (!skipEncryptionKey) {
			obj.key = node.key;
		}

		nodes.push(obj);
	}

	return nodes;
};

/*
    filePermissions:
    1: download files
    2: upload files
    4: delete files

    nodePermissions:
    1: edit node
    2: add node
    4: delete node

    userPermissions:
    1: edit user
    2: -
    4: delete user

    777: everything
*/
export const getPermissions = (number) => {
	if (isNaN(number)) number = parseInt(number);

	const userPermission = number % 10;
	number = (number - userPermission) / 10;
	const nodePermission = number % 10;
	number = (number - nodePermission) / 10;
	const filePermission = number % 10;

	return {
		file: permissionNumberToArray(filePermission),
		node: permissionNumberToArray(nodePermission),
		user: permissionNumberToArray(userPermission),
	};
};

export const permissionNumberToArray = (number): number[] => {
	if (number == 7) return [1, 2, 4];
	if (number == 6) return [2, 4];
	if (number == 5) return [1, 4];
	if (number == 4) return [4];
	if (number == 3) return [1, 2];
	if (number == 2) return [2];
	if (number == 1) return [1];
	if (number == 0) return [0];
	return [];
};

export const reset = async () => {
	let nodes = await getNodes(true, false, true);
	if (nodes.length == 0) nodes = [];

	for (const node of nodes) {
		const body = {
			key: node.ckey,
		};

		const agent = new Agent({
			ca: node.ca,
		});

		await fetch(`https://${node.ip}:${node.port}/deinit`, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' },
			agent,
		});
	}

	db.prepare('DELETE FROM users;').run();
	db.prepare('DELETE FROM files;').run();
	db.prepare('DELETE FROM parts;').run();
	db.prepare('DELETE FROM nodes;').run();

	db.prepare('DROP TABLE users;').run();
	db.prepare('DROP TABLE files;').run();
	db.prepare('DROP TABLE parts;').run();
	db.prepare('DROP TABLE nodes;').run();

	return init();
};
