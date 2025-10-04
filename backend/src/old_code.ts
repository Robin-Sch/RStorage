// const io = new Server(http);
// io.use((socket: socketIOStream, next) => {
// 	const req = socket.handshake;
// 	req.originalUrl = '/';
// 	// @ts-expect-error TODO
// 	return sessionHandler(req, {}, next);
// });
// io.on('connection', (socket: socketIOStream) => {
// 	if (!socket.handshake.session.loggedin) return;

// 	const userID = socket.handshake.session.userID;
// 	socket.join(userID);

// 	socket.on('downloading', (value) => {
// 		return (socket.handshake.session.downloading = value);
// 	});

// 	socket.on('download', async (data) => {
// 		if (!data.path || !data.name) return;
// 		if (!socket.handshake.session.permissions.file.includes(1)) return socket.nsp.to(userID).emit('error', NO_PERMISSIONS);

// 		if (socket.handshake.session.downloading) return socket.nsp.to(userID).emit('error', "You're already downloading a file!");
// 		socket.handshake.session.downloading = true;

// 		const path = cleanPath(data.path);
// 		const name = data.name;

// 		const file = await db.prepare('SELECT * FROM files WHERE path = ? AND name = ?;').get([path, name]);
// 		if (!file) return socket.nsp.to(userID).emit('error', NO_SUCH_FILE_OR_DIR);

// 		const parts = await db.prepare('SELECT * FROM parts WHERE file = ? ORDER BY i;').all(file.id);
// 		if (!parts || parts.length == 0) return socket.nsp.to(userID).emit('error', NO_SUCH_FILE_OR_DIR);

// 		const workerData = { task: 'download', parts, path, name };

// 		const worker = new Worker(join(__dirname, './worker.js'), { workerData });

// 		worker.on('message', (msg) => {
// 			if (msg.toUser) socket.nsp.to(userID).emit(msg.event, msg.data);
// 			else io.sockets.emit(msg.event, msg.data);
// 		});
// 		return;
// 	});

// 	socket.on('delete', async (data) => {
// 		if (!data.name) return;
// 		if (!socket.handshake.session.permissions.file.includes(4)) return socket.nsp.to(userID).emit('error', NO_PERMISSIONS);

// 		const path = cleanPath(data.path);
// 		const name = data.name;

// 		const file = await db.prepare('SELECT * FROM files WHERE path = ? AND name = ?;').get([path, name]);
// 		if (!file) return socket.nsp.to(userID).emit('error', NO_SUCH_FILE_OR_DIR);

// 		const parts = await db.prepare('SELECT * FROM parts WHERE file = ? ORDER BY i;').all(file.id);
// 		if (!parts || parts.length == 0) {
// 			await db.prepare('DELETE FROM files WHERE id = ?;').run([file.id]);
// 			socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} deleted`);
// 			return io.sockets.emit('reload', 'files');
// 		}

// 		const done: string[] = [];

// 		for (const [i, part] of parts.entries()) {
// 			const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([part.node]);

// 			const body = {
// 				id: part.id,
// 				key: node.ckey,
// 			};

// 			const agent = new Agent({
// 				ca: node.ca,
// 			});

// 			try {
// 				const res = await fetch(`https://${node.ip}:${node.port}/files/delete`, {
// 					method: 'POST',
// 					body: JSON.stringify(body),
// 					headers: { 'Content-Type': 'application/json' },
// 					agent,
// 				});

// 				const json = (await res.json()) as APIResponse;

// 				if (!json.success) {
// 					// TODO: mark as deleted, and try again later?
// 					return socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} (${i + 1}/${parts.length}) failed`);
// 				} else {
// 					await db.prepare('DELETE FROM parts WHERE id = ?;').run([part.id]);
// 					done.push(part.id);

// 					if (done.length == parts.length) {
// 						await db.prepare('DELETE FROM files WHERE id = ?;').run([file.id]);
// 						socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} deleted`);
// 						return io.sockets.emit('reload', 'files');
// 					}
// 				}
// 			} catch {
// 				return socket.nsp.to(userID).emit('message', `[delete] [server-side] ${path}${name} (${i + 1}/${parts.length}) failed`);
// 			}
// 		}
// 	});
// });

// const download = async ({ parts, path, name }) => {
// 	const buffers: Record<number, Buffer[]> = {};
// 	for (let i = 0; i < parts.length; i++) {
// 		const part = parts[i];
// 		const curloop = i;
// 		const partID = part.id;

// 		try {
// 			const node = await db.prepare('SELECT * FROM nodes WHERE id = ?;').get([part.node]);

// 			const agent = new Agent({
// 				ca: node.ca,
// 			});

// 			parentPort!.postMessage({
// 				toUser: true,
// 				event: 'message',
// 				data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) downloading from node`,
// 			});

// 			const res = await fetch(`https://${node.ip}:${node.port}/files/download`, {
// 				method: 'POST',
// 				body: JSON.stringify({ id: partID, key: node.ckey }),
// 				headers: { 'Content-Type': 'application/json' },
// 				agent,
// 			});

// 			if (!res.ok) throw new Error(res.body?.toString());

// 			parentPort!.postMessage({
// 				toUser: true,
// 				event: 'message',
// 				data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) downloaded from node`,
// 			});
// 			parentPort!.postMessage({
// 				toUser: true,
// 				event: 'message',
// 				data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) decrypting`,
// 			});

// 			const iv = part.iv;
// 			const decipher = createDecipheriv('aes-256-ctr', node.key, iv);
// 			const partBuffer: Buffer[] = [];

// 			await pipeline(
// 				// @ts-expect-error TODO
// 				res.body,
// 				decipher,
// 				new Writable({
// 					write(chunk, encoding, callback) {
// 						partBuffer.push(chunk);
// 						callback();
// 					},
// 				})
// 			);

// 			buffers[part.i] = partBuffer;
// 			parentPort!.postMessage({ toUser: true, event: 'message', data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) decrypted` });
// 		} catch (e) {
// 			console.error(e);
// 			return parentPort!.postMessage({
// 				toUser: true,
// 				event: 'message',
// 				data: `[download] [server-side] ${path}${name} (${curloop + 1}/${parts.length}) failed`,
// 			});
// 		}
// 	}

// 	// Combine all buffers
// 	const orderedBuffers = Object.keys(buffers)
// 		.sort()
// 		.reduce((acc, key) => [...acc, ...buffers[Number(key)]], [] as Buffer[]);

// 	const content = Buffer.concat(orderedBuffers);

// 	return parentPort!.postMessage({ toUser: true, event: 'download', data: { content, name, path } });
// };
