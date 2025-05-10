import FormData from 'form-data';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import fetch from 'node-fetch';
import { createReadStream, createWriteStream, unlinkSync } from 'node:fs';
import { Agent } from 'node:https';
import { join } from 'node:path';
import { workerData, parentPort, isMainThread } from 'node:worker_threads';

import { db } from './sql';
import { bufferToStream } from './utils';
import { pipeline, Writable } from 'node:stream';
import { APIRes } from './types';

const tempDir = join(__dirname, '../', 'files');

if (!isMainThread && parentPort !== null) {
	const upload = async ({ dataForThisLoop, nodeForThisLoop, fileID, partID, curloop, loops, path, name }) => {
		try {
			parentPort!.postMessage({ toUser: true, event: 'message', data: `[upload] [server-side] ${path}${name} (${curloop + 1}/${loops}) encrypting` });

			const iv = randomBytes(16);
			const cipher = createCipheriv('aes-256-ctr', nodeForThisLoop.key, iv);
			const encryptedPath = `${tempDir}/${partID}`;

			// MODIFIED
			await pipeline(bufferToStream(dataForThisLoop), cipher, createWriteStream(encryptedPath));

			parentPort!.postMessage({ toUser: true, event: 'message', data: `[upload] [server-side] ${path}${name} (${curloop + 1}/${loops}) encrypted` });

			const formData = new FormData();
			formData.append('file', createReadStream(`${tempDir}/${partID}`));
			formData.append('key', nodeForThisLoop.ckey);

			const agent = new Agent({
				ca: nodeForThisLoop.ca,
			});

			parentPort!.postMessage({ toUser: true, event: 'message', data: `[upload] [server-side] ${path}${name} (${curloop + 1}/${loops}) uploading to node` });

			const res = await fetch(`https://${nodeForThisLoop.ip}:${nodeForThisLoop.port}/files/upload`, {
				method: 'POST',
				body: formData,
				agent,
			});
			const json = (await res.json()) as APIRes;

			if (!json.success) {
				// TODO: delete all uploaded parts, and throw error?
				return parentPort!.postMessage({ toUser: true, event: 'message', data: `[upload] [server-side] ${path}${name} (${curloop + 1}/${loops}) failed` });
			} else {
				await db.prepare('INSERT INTO parts (id, file, node, iv, i) VALUES (?,?,?,?,?);').run([partID, fileID, nodeForThisLoop.id, iv, curloop]);
				await unlinkSync(`${tempDir}/${partID}`);

				parentPort!.postMessage({ toUser: true, event: 'message', data: `[upload] [server-side] ${path}${name} (${curloop + 1}/${loops}) uploaded to node` });

				if (curloop == loops - 1) {
					// TODO: io.sockets.emit('reload', 'files');
					return parentPort!.postMessage({ event: 'reload', data: 'files' });
				}
			}
		} catch (e) {
			return parentPort!.postMessage({ toUser: true, event: 'message', data: `[upload] [server-side] ${path}${name} (${curloop + 1}/${loops}) failed` });
		}
	};

	const download = async ({ parts, path, name }) => {
		const buffers: Record<number, Buffer[]> = {};
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const curloop = i;
			const partID = part.id;

			try {
				const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([part.node]);

				const agent = new Agent({
					ca: node.ca,
				});

				parentPort!.postMessage({
					toUser: true,
					event: 'message',
					data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) downloading from node`,
				});

				const res = await fetch(`https://${node.ip}:${node.port}/files/download`, {
					method: 'POST',
					body: JSON.stringify({ id: partID, key: node.ckey }),
					headers: { 'Content-Type': 'application/json' },
					agent,
				});

				if (!res.ok) throw new Error(res.body?.toString());

				parentPort!.postMessage({
					toUser: true,
					event: 'message',
					data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) downloaded from node`,
				});
				parentPort!.postMessage({
					toUser: true,
					event: 'message',
					data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) decrypting`,
				});

				const iv = part.iv;
				const decipher = createDecipheriv('aes-256-ctr', node.key, iv);
				const partBuffer: Buffer[] = [];

				await pipeline(
					// @ts-expect-error TODO
					res.body,
					decipher,
					new Writable({
						write(chunk, encoding, callback) {
							partBuffer.push(chunk);
							callback();
						},
					})
				);

				buffers[part.i] = partBuffer;
				parentPort!.postMessage({ toUser: true, event: 'message', data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) decrypted` });
			} catch (e) {
				return parentPort!.postMessage({
					toUser: true,
					event: 'message',
					data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) failed`,
				});
			}
		}

		// Combine all buffers
		const orderedBuffers = Object.keys(buffers)
			.sort()
			.reduce((acc, key) => [...acc, ...buffers[Number(key)]], [] as Buffer[]);

		const content = Buffer.concat(orderedBuffers);

		return parentPort!.postMessage({ toUser: true, event: 'download', data: { content, name, path } });
	};

	if (workerData.task == 'upload') upload(workerData);
	if (workerData.task == 'download') download(workerData);
}
