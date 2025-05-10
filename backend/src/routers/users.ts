import { Router } from 'express';
import speakeasy from 'speakeasy';
import { compare, hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../sql';
import { getPermissions } from '../utils';
import { INVALID_USER, NO_PERMISSIONS, INVALID_BODY, REGISTERING_DISABLED, SUCCESS, NOT_LOGGED_IN } from '../responses';
import { APIResponse, APITOTPResponse, APIUserResponse, APIUsersResponse } from '../../types';

const PANEL_DISABLE_REGISTER = process.env.PANEL_DISABLE_REGISTER && process.env.PANEL_DISABLE_REGISTER.toLowerCase() === 'false' ? false : true;

const usersRouter = Router();

usersRouter
	.get('/me', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}

		res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
	})
	.get('/', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.user.includes(1)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const users = await db.prepare('SELECT id, username, permissions FROM users;').all();
		res.status(200).json(<APIUsersResponse>{ users, message: SUCCESS, success: true });
	})
	.get('/:id/', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.user.includes(1)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const user = await db.prepare('SELECT id, username, permissions FROM users WHERE id = ?;').get([req.params.id]);
		if (!user) {
			res.status(403).json(<APIResponse>{ message: INVALID_USER, success: false });
			return;
		}

		res.status(200).json(<APIUserResponse>{ user, message: SUCCESS, success: true });
	})
	.put('/:id', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.user.includes(1)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const { username, password, permissions } = req.body;
		if (!username || !permissions) {
			res.status(400).json(<APIResponse>{ message: INVALID_BODY, success: false });
			return;
		}

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
		if (!user) {
			res.status(403).json(<APIResponse>{ message: INVALID_USER, success: false });
			return;
		}

		let temp = permissions;
		if (isNaN(temp)) temp = parseInt(temp);

		const userPermission = temp % 10;
		temp = (temp - userPermission) / 10;
		const nodePermission = temp % 10;
		temp = (temp - nodePermission) / 10;
		const filePermission = temp % 10;

		if (filePermission < 0 || filePermission > 8 || nodePermission < 0 || nodePermission > 8 || userPermission < 0 || userPermission > 8) {
			res.status(400).json(<APIResponse>{ message: INVALID_BODY, success: false });
			return;
		}

		let hashedPassword = user.password;
		if (password) hashedPassword = await hash(password, 10);

		await db.prepare('UPDATE users SET username = ?, password = ?, permissions = ? WHERE id = ?;').run([username, hashedPassword, permissions, req.params.id]);
		res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
	})
	.delete('/:id/', async (req, res) => {
		if (!req.session.loggedin) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}
		if (!req.session.permissions?.user.includes(4)) {
			res.status(403).json(<APIResponse>{ message: NO_PERMISSIONS, success: false });
			return;
		}

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
		if (!user) {
			res.status(403).json(<APIResponse>{ message: INVALID_USER, success: false });
			return;
		}

		await db.prepare('DELETE FROM users WHERE id = ?;').run([req.params.id]);
		res.status(200).json(<APIResponse>{ message: SUCCESS, success: true });
	})
	.post('/login', async (req, res) => {
		const { username, password, token } = req.body;
		if (!username || !password) {
			res.status(400).json(<APIResponse>{ message: 'Please enter Username and Password!', success: false });
			return;
		}

		const user = await db.prepare('SELECT * FROM users WHERE username = ?;').get([username]);
		if (!user) {
			res.status(400).json(<APIResponse>{ message: 'Incorrect Username and/or Password!', success: false });
			return;
		}

		// if (!user.verified) return res.json({ message: 'Please reregister, you haven\'t verified your 2fa!', success: false });
		if (user.secret && !token) {
			res.status(400).json(<APIResponse>{ message: 'Please enter 2fa code!', success: false });
			return;
		}

		if (user.secret && token) {
			const valid = speakeasy.totp.verify({
				secret: user.secret,
				encoding: 'base32',
				token,
				window: 1,
			});

			if (!valid) {
				res.status(400).json(<APIResponse>{ message: 'Invalid 2fa code!', success: false });
				return;
			}
		}

		if (await compare(password, user.password)) {
			req.session.loggedin = true;
			req.session.username = user.username;
			req.session.userID = user.id;
			req.session.permissions = await getPermissions(user.permissions);

			res.status(200).json(<APIResponse>{ message: 'Correct', success: true });
		} else {
			res.status(400).json(<APIResponse>{ message: 'Incorrect Username and/or Password!', success: false });
		}
	})
	.post('/register', async (req, res) => {
		if (PANEL_DISABLE_REGISTER) {
			res.status(400).json(<APIResponse>{ message: REGISTERING_DISABLED, success: false });
			return;
		}

		const { username, password, totp } = req.body;
		if (!username || !password || totp == undefined) {
			res.status(400).json(<APIResponse>{ message: 'Please enter Username and Password!', success: false });
			return;
		}

		const alreadyUsername = await db.prepare('SELECT * FROM users WHERE username = ?;').get([username]);
		if (alreadyUsername) {
			res.status(400).json(<APIResponse>{ message: 'That username is already registered!', success: false });
			return;
		}

		let secret = undefined;
		if (totp) secret = speakeasy.generateSecret({ length: 20 }).base32;

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

		res.json(<APIResponse | APITOTPResponse>json);
	})
	.post('/totp-verify', async (req, res) => {
		if (!req.session.userID) {
			res.status(401).json(<APIResponse>{ message: NOT_LOGGED_IN, success: false });
			return;
		}

		const { token } = req.body;
		if (!token) {
			res.status(400).json(<APIResponse>{ message: 'Please enter the token!', success: false });
			return;
		}

		const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.session.userID]);
		if (!user) {
			res.status(400).json(<APIResponse>{ message: 'That username is not registered!', success: false });
			return;
		}

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

			res.status(200).json(<APIResponse>{ success: true });
		} else res.status(400).json(<APIResponse>{ message: 'Invalid totp code', success: false });
	});

export default usersRouter;
