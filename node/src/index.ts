import express from 'express';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, createReadStream } from 'fs';
import multer from 'multer';
import { createCertificate } from 'pem';
import { createServer } from 'node:https';

const IPs = [];

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, join(__dirname, '../', 'files'));
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});
const upload = multer({ storage });

import { ALREADY_CONNECTED_TO_PANEL, NOT_CONNECTED_TO_PANEL, NO_SUCH_FILE_OR_DIR, INVALID_BODY, SUCCESS } from './responses';

const NODE_COMMONNAME = process.env.NODE_COMMONNAME || '127.0.0.1';
const NODE_PORT = parseInt(process.env.NODE_PORT || '3001') || 3001;

const dir = join(__dirname, '../', 'files');
if (!existsSync(join(__dirname, '../', 'keys'))) mkdirSync(join(__dirname, '../', 'keys'));
if (!existsSync(join(__dirname, '../', 'files'))) mkdirSync(join(__dirname, '../', 'files'));
let NODE_KEY = existsSync(join(__dirname, '../', 'keys/node.key')) ? readFileSync(join(__dirname, '../', 'keys/node.key'), 'utf8') : null;
let NODE_CA = existsSync(join(__dirname, '../', 'keys/ca.key')) ? readFileSync(join(__dirname, '../', 'keys/ca.key'), 'utf8') : null;
let NODE_CERT = existsSync(join(__dirname, '../', 'keys/node.cert')) ? readFileSync(join(__dirname, '../', 'keys/node.cert'), 'utf8') : null;
let PANEL_KEY = existsSync(join(__dirname, '../', 'keys/panel.key')) ? readFileSync(join(__dirname, '../', 'keys/panel.key'), 'utf8') : null;

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

		writeFileSync(join(__dirname, '../', 'keys/node.key'), keys.serviceKey);
		writeFileSync(join(__dirname, '../', 'keys/ca.key'), keys.clientKey);
		writeFileSync(join(__dirname, '../', 'keys/node.cert'), keys.certificate);

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
		const key = req.body.key;
		if (!key) return res.status(400).json({ message: INVALID_BODY, success: false });

		if (PANEL_KEY && PANEL_KEY !== key) return res.status(403).json({ message: ALREADY_CONNECTED_TO_PANEL, success: false });

		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
		// @ts-expect-error yes
		if (!IPs.includes(ip)) IPs.push(ip);

		if (!PANEL_KEY) {
			PANEL_KEY = key;
			writeFileSync(join(__dirname, '../', 'keys/panel.key'), key);
		}

		return res.status(200).json({ message: SUCCESS, success: true });
	})
	.post('/deinit', (req, res) => {
		if (!PANEL_KEY) return res.status(400).json({ message: NOT_CONNECTED_TO_PANEL, success: false, reconnect: true });

		const key = req.body.key;
		if (key !== PANEL_KEY) {
			return res.status(403).json({ message: ALREADY_CONNECTED_TO_PANEL, success: false });
		}

		PANEL_KEY = null;
		unlinkSync(join(__dirname, '../', 'keys/panel.key'));

		return res.status(200).json({ message: SUCCESS, success: true });
	})
	.post('/files/delete', async (req, res) => {
		if (!PANEL_KEY) return res.status(400).json({ message: NOT_CONNECTED_TO_PANEL, success: false, reconnect: true });

		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
		const key = req.body.key;
		// @ts-expect-error yes
		if (key !== PANEL_KEY || !IPs.includes(ip)) return res.status(403).json({ message: ALREADY_CONNECTED_TO_PANEL, success: false });

		const id = req.body.id;
		if (!id) return res.status(400).json({ message: INVALID_BODY, success: false });
		if (!existsSync(`${dir}/${id}`)) return res.status(400).json({ message: NO_SUCH_FILE_OR_DIR, success: false });

		unlinkSync(`${dir}/${id}`);

		return res.status(200).json({ message: SUCCESS, success: true });
	})
	.post('/files/upload', upload.single('file'), async (req, res) => {
		if (!PANEL_KEY) return res.status(400).json({ message: NOT_CONNECTED_TO_PANEL, success: false, reconnect: true });

		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
		const key = req.body.key;
		// @ts-expect-error yes
		if (key !== PANEL_KEY || !IPs.includes(ip)) return res.status(403).json({ message: ALREADY_CONNECTED_TO_PANEL, success: false });

		const json = {
			message: SUCCESS,
			success: true,
		};
		return res.status(200).json(json);
	})
	.post('/files/download', async (req, res) => {
		if (!PANEL_KEY) return res.status(400).json({ message: NOT_CONNECTED_TO_PANEL, success: false, reconnect: true });

		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
		const key = req.body.key;
		// @ts-expect-error yes
		if (key !== PANEL_KEY || !IPs.includes(ip)) return res.status(403).json({ message: ALREADY_CONNECTED_TO_PANEL, success: false });

		const id = req.body.id;
		if (!id) return res.status(400).json({ message: INVALID_BODY, success: false });
		if (!existsSync(`${dir}/${id}`)) return res.status(400).json({ message: NO_SUCH_FILE_OR_DIR, success: false });

		return createReadStream(`${dir}/${id}`).pipe(res);
	})
	.get('*splat', (req, res) => {
		return res.status(200).send('Please use the panel!');
	});

start();
