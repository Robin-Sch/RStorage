export interface NodeInfo {
	id: string;
	ip?: string;
	port?: number;
	key?: Buffer;
	ckey?: string;
	ca?: string | Buffer;
}

export interface NodeConInfo extends NodeInfo {
	connected?: boolean;
}

export type APIRes = {
	success: boolean;
	message: string;
};

export type UserInfo = {
	id: string;
	username: string;
	permissions?: string;
};

export type UploadTask = {
	task: 'upload';
	dataForThisLoop: Buffer;
	nodeForThisLoop: NodeInfo;
	fileID: string;
	partID: string;
	curloop: number;
	loops: number;
	path: string;
	name: string;
};

export type DownloadTask = {
	task: 'download';
	parts: Array<{
		id: string;
		node: string;
		iv: Buffer;
		i: number;
	}>;
	path: string;
	name: string;
};

export type WorkerTask = UploadTask | DownloadTask;
