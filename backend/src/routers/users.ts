import { Router } from 'express';
import speakeasy from 'speakeasy';
import { compare, hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../sql';
import { getPermissions } from '../utils';
import { INVALID_USER, NO_PERMISSIONS, INVALID_BODY, REGISTERING_DISABLED, SUCCESS, NOT_LOGGED_IN } from '../responses';

const PANEL_DISABLE_REGISTER = process.env.PANEL_DISABLE_REGISTER && process.env.PANEL_DISABLE_REGISTER.toLowerCase() === 'false' ? false : true;

const usersRouter = Router();

usersRouter
	.get('/me', async (req, res) => {
		if (!req.session.loggedin) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });

		return res.status(200).json({ message: SUCCESS, success: true });
	})
	.get('/', async (req, res) => {
		if (!req.session.loggedin) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });
		if (!req.session.permissions.user.includes(1)) return res.status(403).json({ message: NO_PERMISSIONS, success: false });

		const data = await db.prepare('SELECT * FROM users;').all();
		return res.status(200).json({ data, message: SUCCESS, success: true });
	})
	.get('/:id/', async (req, res) => {
		if (!req.session.loggedin) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });
		if (!req.session.permissions.user.includes(1)) return res.status(403).json({ message: NO_PERMISSIONS, success: false });

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
		if (!user) return res.status(403).json({ message: INVALID_USER, success: false });

		const data = {
			id: user.id,
			username: user.username,
			permissions: user.permissions,
		};

		return res.status(200).json({ data, success: true });
	})
	.put('/:id', async (req, res) => {
		if (!req.session.loggedin) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });
		if (!req.session.permissions.user.includes(1)) return res.status(403).json({ message: NO_PERMISSIONS, success: false });

		const { username, password, permissions } = req.body;
		if (!username || !permissions) return res.status(400).json({ message: INVALID_BODY, success: false });

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
		if (!user) return res.status(403).json({ message: INVALID_USER, success: false });

		let temp = permissions;
		if (isNaN(temp)) temp = parseInt(temp);

		const userPermission = temp % 10;
		temp = (temp - userPermission) / 10;
		const nodePermission = temp % 10;
		temp = (temp - nodePermission) / 10;
		const filePermission = temp % 10;

		if (![0, 1, 2, 3, 4, 5, 6, 7].includes(filePermission)) return res.status(400).json({ message: INVALID_BODY, success: false });
		if (![0, 1, 2, 3, 4, 5, 6, 7].includes(nodePermission)) return res.status(400).json({ message: INVALID_BODY, success: false });
		if (![0, 1, 2, 3, 4, 5, 6, 7].includes(userPermission)) return res.status(400).json({ message: INVALID_BODY, success: false });

		let hashedPassword = user.password;
		if (password) hashedPassword = await hash(password, 10);

		await db.prepare('UPDATE users SET username = ?, password = ?, permissions = ? WHERE id = ?;').run([username, hashedPassword, permissions, req.params.id]);

		return res.status(200).json({ message: SUCCESS, success: true });
	})
	.delete('/:id/', async (req, res) => {
		if (!req.session.loggedin) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });
		if (!req.session.permissions.user.includes(4)) return res.status(403).json({ message: NO_PERMISSIONS, success: false });

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
		if (!user) return res.status(403).json({ message: INVALID_USER, success: false });

		await db.prepare('DELETE FROM users WHERE id = ?;').run([req.params.id]);

		return res.status(200).json({ message: SUCCESS, success: true });
	})
	.post('/login', async (req, res) => {
		const { username, password, token } = req.body;
		if (!username || !password) return res.json({ message: 'Please enter Username and Password!', success: false });

		const user = await db.prepare('SELECT * FROM users WHERE username = ?;').get([username]);
		if (!user) return res.json({ message: 'Incorrect Username and/or Password!', success: false });

		// if (!user.verified) return res.json({ message: 'Please reregister, you haven\'t verified your 2fa!', success: false });
		if (user.secret && !token) return res.json({ message: 'Please enter 2fa code!', success: false });
		if (user.secret && token) {
			const valid = speakeasy.totp.verify({
				secret: user.secret,
				encoding: 'base32',
				token,
				window: 1,
			});

			if (!valid) return res.json({ message: 'Invalid 2fa code!', success: false });
		}

		if (await compare(password, user.password)) {
			req.session.loggedin = true;
			req.session.username = user.username;
			req.session.userID = user.id;
			req.session.permissions = await getPermissions(user.permissions);

			return res.json({ message: 'Correct', success: true });
		} else {
			return res.json({ message: 'Incorrect Username and/or Password!', success: false });
		}
	})
	.post('/register', async (req, res) => {
		if (PANEL_DISABLE_REGISTER) return res.json({ message: REGISTERING_DISABLED, success: false });

		const { username, password, totp } = req.body;
		if (!username || !password || totp == undefined) return res.json({ message: 'Please enter Username and Password!', success: false });

		const alreadyUsername = await db.prepare('SELECT * FROM users WHERE username = ?;').get([username]);
		if (alreadyUsername) return res.json({ message: 'That username is already registered!', success: false });

		let secret = undefined;
		if (totp) {
			secret = speakeasy.generateSecret({ length: 20 }).base32;
		}

		const hashedPassword = await hash(password, 10);
		const id = uuidv4();
		const verified = secret ? 'false' : 'true';
		const permissions = '000';

		await db
			.prepare('INSERT INTO users (id, username, password, verified, secret, permissions) VALUES (?,?,?,?,?,?);')
			.run([id, username, hashedPassword, verified, secret, permissions]);

		// If user does not have to veriy TOTP, they are logged in
		if (!secret) {
			req.session.loggedin = true;
			req.session.username = username;
			req.session.permissions = await getPermissions(permissions);
		}

		// But in all cases set user ID
		req.session.userID = id;

		const json: { message: string; success: true; secret?: string } = { message: 'Correct', success: true };
		if (secret) json.secret = secret;
		return res.json(json);
	})
	.post('/totp-verify', async (req, res) => {
		if (!req.session.userID) return res.status(401).json({ message: NOT_LOGGED_IN, success: false });

		const { token } = req.body;
		if (!token) return res.json({ message: 'Please enter the token!', success: false });

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.session.userID]);
		if (!user) return res.json({ message: 'That username is not registered!', success: false });

		const verified = speakeasy.totp.verify({
			secret: user.secret,
			encoding: 'base32',
			token,
			window: 1,
		});

		if (verified) {
			// TODO: save in database that user is verified?
			req.session.loggedin = true;
			req.session.username = user.username;
			req.session.permissions = await getPermissions(user.permissions);

			return res.json({ success: true });
		} else {
			return res.json({ message: 'Invalid totp code', success: false });
		}
	});

export default usersRouter;
