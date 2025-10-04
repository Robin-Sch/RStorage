import express from 'express';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, createReadStream, createWriteStream } from 'node:fs';
import { createServer } from 'node:https';
import { createCertificate } from 'pem';
import { APIRequestError } from './types';

const IPs: string[] = [];

const NODE_COMMONNAME = process.env.NODE_COMMONNAME || '127.0.0.1';
const NODE_PORT = parseInt(process.env.NODE_PORT || '3001') || 3001;

const nodeDir = join(__dirname, '../../'); // because of dist/src/index.js
const filesDir = join(nodeDir, 'files');
const keysDir = join(nodeDir, 'keys');

if (!existsSync(filesDir)) mkdirSync(filesDir);
if (!existsSync(keysDir)) mkdirSync(keysDir);

let NODE_KEY = existsSync(join(keysDir, 'node.key')) ? readFileSync(join(keysDir, 'node.key'), 'utf8') : null;
let NODE_CA = existsSync(join(keysDir, 'ca.key')) ? readFileSync(join(keysDir, 'ca.key'), 'utf8') : null;
let NODE_CERT = existsSync(join(keysDir, 'node.cert')) ? readFileSync(join(keysDir, 'node.cert'), 'utf8') : null;
let PANEL_KEY = existsSync(join(keysDir, 'panel.key')) ? readFileSync(join(keysDir, 'panel.key'), 'utf8') : null;

async function start() {
	if (!NODE_KEY || !NODE_CA || !NODE_CERT) {
		const keys: { csr: string; clientKey: string; certificate: string; serviceKey: string } = await new Promise((resolve, reject) => {
			createCertificate({ selfSigned: true, commonName: NODE_COMMONNAME }, (err, keys) => {
				if (err) reject(err);
				else resolve(keys);
			});
		});

		NODE_KEY = keys.serviceKey;
		NODE_CA = keys.clientKey;
		NODE_CERT = keys.certificate;

		writeFileSync(join(keysDir, 'node.key'), keys.serviceKey);
		writeFileSync(join(keysDir, 'ca.key'), keys.clientKey);
		writeFileSync(join(keysDir, 'node.cert'), keys.certificate);

		console.log(`To install this node, login on the panel, and enter the IP or hostname (${NODE_COMMONNAME}) and port (${NODE_PORT}) of this server!`);
		console.log('The certificate can be found below! (copy the -----BEGIN CERTIFICATE----- and -----END CERTIFICATE----- too!)');
		console.log('');
		console.log(NODE_CERT);
	}

	createServer({ key: NODE_KEY, cert: NODE_CERT, ca: NODE_CA }, app).listen(NODE_PORT, () => {
		console.log(`Server online on port ${NODE_PORT}`);
	});
}

const app = express();

app
	.use(express.json({ limit: '2000mb' }))
	.use(express.urlencoded({ limit: '2000mb', extended: true }))
	.set('views', join(__dirname, 'views'))
	.set('view engine', 'ejs')
	.post('/init', (req, res) => {
		try {
			const key = req.body.key;
			if (!key) throw new APIRequestError();
			if (PANEL_KEY && PANEL_KEY !== key) throw new APIRequestError(403, { message: 'The node is already connected to a different panel!', success: false });

			const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
			if (!IPs.includes(ip)) IPs.push(ip);

			if (!PANEL_KEY) {
				PANEL_KEY = key;
				writeFileSync(join(__dirname, '../', 'keys/panel.key'), key);
			}

			res.status(200).json({ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/deinit', (req, res) => {
		try {
			// @ts-expect-error Extra property
			if (!PANEL_KEY) throw new APIRequestError(400, { message: 'The node is not (yet) connected to a panel!', success: false, reconnect: true });

			const key = req.body.key;
			const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
			if (!key) throw new APIRequestError();
			if (PANEL_KEY !== key || !IPs.includes(ip))
				throw new APIRequestError(403, { message: 'The node is already connected to a different panel!', success: false });

			PANEL_KEY = null;
			unlinkSync(join(__dirname, '../', 'keys/panel.key'));

			res.status(200).json({ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/files/delete', async (req, res) => {
		try {
			// @ts-expect-error Extra property
			if (!PANEL_KEY) throw new APIRequestError(400, { message: 'The node is not (yet) connected to a panel!', success: false, reconnect: true });

			const key = req.body.key;
			const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
			if (!key) throw new APIRequestError();
			if (PANEL_KEY !== key || !IPs.includes(ip))
				throw new APIRequestError(403, { message: 'The node is already connected to a different panel!', success: false });

			const id = req.body.id;
			if (!id) throw new APIRequestError();
			if (!existsSync(`${filesDir}/${id}`)) throw new APIRequestError(400, { message: 'That file or directory does not exists!', success: false });

			unlinkSync(`${filesDir}/${id}`);

			res.status(200).json({ message: '', success: true });
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/files/upload', async (req, res) => {
		try {
			// @ts-expect-error Extra property
			if (!PANEL_KEY) throw new APIRequestError(400, { message: 'The node is not (yet) connected to a panel!', success: false, reconnect: true });

			const key = req.headers['authorization']?.toString();
			const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
			if (!key) throw new APIRequestError();
			if (PANEL_KEY !== key || !IPs.includes(ip))
				throw new APIRequestError(403, { message: 'The node is already connected to a different panel!', success: false });

			const name = req.headers['x-filename']?.toString();
			if (!name) throw new APIRequestError();

			const filePath = join(__dirname, '../', 'files', name);
			const writeStream = createWriteStream(filePath);
			req.pipe(writeStream);

			writeStream.on('finish', () => {
				res.status(200).json({ message: '', success: true });
			});

			writeStream.on('error', (err) => {
				res.status(500).json({ message: err, success: false }); // TODO: err msg
			});
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.post('/files/download', async (req, res) => {
		try {
			// @ts-expect-error Extra property
			if (!PANEL_KEY) throw new APIRequestError(400, { message: 'The node is not (yet) connected to a panel!', success: false, reconnect: true });

			const key = req.body.key;
			const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
			if (!key) throw new APIRequestError();
			if (PANEL_KEY !== key || !IPs.includes(ip))
				throw new APIRequestError(403, { message: 'The node is already connected to a different panel!', success: false });

			const id = req.body.id;
			if (!id) throw new APIRequestError();
			if (!existsSync(`${filesDir}/${id}`)) throw new APIRequestError(400, { message: 'That file or directory does not exists!', success: false });

			return createReadStream(`${filesDir}/${id}`).pipe(res);
		} catch (e) {
			if (e instanceof APIRequestError) res.status(e.status).json(e.json);
			else {
				console.error(e);
				res.status(400).json({ message: 'Something went wrong, please try again!', success: false });
			}
		}
	})
	.get('*splat', (req, res) => {
		res.status(200).send('Please use the panel!');
	});

start();
