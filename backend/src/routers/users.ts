import { Router } from 'express';
import speakeasy from 'speakeasy';
import { compare, hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../sql';
import { getPermissions } from '../utils';
import { APIRequestError, APIResponse, APITOTPResponse, APIUserResponse, APIUsersResponse } from '../../types';

const PANEL_DISABLE_REGISTER = process.env.PANEL_DISABLE_REGISTER && process.env.PANEL_DISABLE_REGISTER.toLowerCase() === 'false' ? false : true;

const usersRouter = Router();

usersRouter
	.get('/me', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });

			res.status(200).json(<APIResponse>{ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.get('/', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.user.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const users = await db.prepare('SELECT id, username, permissions FROM users;').all();
			res.status(200).json(<APIUsersResponse>{ users, message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.get('/:id/', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.user.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const user = await db.prepare('SELECT id, username, permissions FROM users WHERE id = ?;').get([req.params.id]);
			if (!user) throw new APIRequestError(400, { message: 'No user with that ID found!', success: false });

			res.status(200).json(<APIUserResponse>{ user, message: '', success: true });
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
			if (!req.session.permissions?.user.includes(1))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const { username, password, permissions } = req.body;
			if (!username || !permissions) throw new APIRequestError();

			const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
			if (!user) throw new APIRequestError(400, { message: 'No user with that ID found!', success: false });

			let temp = permissions;
			if (isNaN(temp)) temp = parseInt(temp);

			const userPermission = temp % 10;
			temp = (temp - userPermission) / 10;
			const nodePermission = temp % 10;
			temp = (temp - nodePermission) / 10;
			const filePermission = temp % 10;

			if (filePermission < 0 || filePermission > 8 || nodePermission < 0 || nodePermission > 8 || userPermission < 0 || userPermission > 8)
				throw new APIRequestError();

			let hashedPassword = user.password;
			if (password) hashedPassword = await hash(password, 10);

			await db
				.prepare('UPDATE users SET username = ?, password = ?, permissions = ? WHERE id = ?;')
				.run([username, hashedPassword, permissions, req.params.id]);
			res.status(200).json(<APIResponse>{ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.delete('/:id/', async (req, res) => {
		try {
			if (!req.session.loggedin) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });
			if (!req.session.permissions?.user.includes(4))
				throw new APIRequestError(403, { message: 'You do not have enough permissions to do that action!', success: false });

			const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.params.id]);
			if (!user) throw new APIRequestError(400, { message: 'No user with that ID found!', success: false });

			await db.prepare('DELETE FROM users WHERE id = ?;').run([req.params.id]);
			res.status(200).json(<APIResponse>{ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/login', async (req, res) => {
		try {
			const { username, password, token } = req.body;
			if (!username || !password) throw new APIRequestError(400, { message: 'Please enter Username and Password!', success: false });

			const user = await db.prepare('SELECT * FROM users WHERE username = ?;').get([username]);
			if (!user) throw new APIRequestError(400, { message: 'Incorrect Username and/or Password!', success: false });

			// if (!user.verified) return res.json({ message: 'Please reregister, you haven\'t verified your 2fa!', success: false });
			if (user.secret && !token) throw new APIRequestError(400, { message: 'Please enter 2fa code!', success: false });

			if (user.secret && token) {
				const valid = speakeasy.totp.verify({
					secret: user.secret,
					encoding: 'base32',
					token,
					window: 1,
				});

				if (!valid) throw new APIRequestError(400, { message: 'Invalid 2fa code!', success: false });
			}

			if (await compare(password, user.password)) {
				req.session.loggedin = true;
				req.session.username = user.username;
				req.session.userID = user.id;
				req.session.permissions = await getPermissions(user.permissions);

				res.status(200).json(<APIResponse>{ message: 'Correct', success: true });
			} else throw new APIRequestError(400, { message: 'Incorrect Username and/or Password!', success: false });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/register', async (req, res) => {
		try {
			if (PANEL_DISABLE_REGISTER)
				throw new APIRequestError(400, { message: 'Registering is disabled! If this is your first time, please check the readme!', success: false });

			const { username, password, totp } = req.body;
			if (!username || !password || totp == undefined) throw new APIRequestError(400, { message: 'Please enter Username and Password!', success: false });

			const alreadyUsername = await db.prepare('SELECT * FROM users WHERE username = ?;').get([username]);
			if (alreadyUsername) throw new APIRequestError(400, { message: 'That username is already registered!', success: false });

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

			const json: { message: string; success: true; secret?: string } = { message: '', success: true };
			if (secret) json.secret = secret;

			res.json(<APIResponse | APITOTPResponse>json);
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/totp-verify', async (req, res) => {
		try {
			if (!req.session.userID) throw new APIRequestError(401, { message: 'You are not logged in!', success: false });

			const { token } = req.body;
			if (!token) throw new APIRequestError(400, { message: 'Please enter the token!', success: false });

			const user = await db.prepare('SELECT * FROM users WHERE id = ?;').get([req.session.userID]);
			if (!user) throw new APIRequestError(400, { message: 'That username is not registered!', success: false });

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
			}
			throw new APIRequestError(400, { message: 'Invalid totp code', success: false });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	});

export default usersRouter;
