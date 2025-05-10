import sqlite3 from 'better-sqlite3';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { hash } from 'bcrypt';

const db = sqlite3(join(__dirname, 'database.db'));

const init = () => {
	db.prepare('CREATE TABLE if not exists users (id TEXT, username TEXT, password TEXT, verified BOOL, secret TEXT, permissions TEXT);').run();
	(async () => {
		const adminUser = await db.prepare('SELECT * FROM users WHERE username = ?;').get(['admin']);
		if (!adminUser) {
			const username = 'admin';
			const password = 'admin';
			const hashedPassword = await hash(password, 10);
			const id = uuidv4();
			const verified = 'true';
			const secret = undefined;
			const permissions = '777';
			await db
				.prepare('INSERT INTO users (id, username, password, verified, secret, permissions) VALUES (?,?,?,?,?,?);')
				.run([id, username, hashedPassword, verified, secret, permissions]);
		}
	})();

	db.prepare('CREATE TABLE if not exists nodes (id TEXT, ip TEXT, port INTEGER, ca TEXT, key TEXT, ckey TEXT);').run();
	db.prepare('CREATE TABLE if not exists files (id TEXT, name TEXT, path TEXT);').run();
	db.prepare('CREATE TABLE if not exists parts (id TEXT, file TEXT, node TEXT, iv TEXT, i INTEGER);').run();
};

init();

export { db, init };
