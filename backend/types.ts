export type Node = {
	id: string;
	connected: boolean;
	ip: string;
	port: string;
	ca: string;
	key: string; // encryption key
	ckey: string; // auth key
};

export type User = {
	id: string;
	username: string;
	permissions: string;
};

export type RFile = {
	name: string;
};

export type Directory = {
	path: string;
};

export type APIResponse = {
	message: string;
	success: boolean;
};

export type APINodeResponse = APIResponse & {
	node: Node;
};

export type APINodesResponse = APIResponse & {
	nodes: Node[];
};

export type APIUserResponse = APIResponse & {
	user: User;
};

export type APIUsersResponse = APIResponse & {
	users: User[];
};

export type APIFilesResponse = APIResponse & {
	files: RFile[];
	directories: Directory[];
};

export type APITOTPResponse = APIResponse & {
	secret: string;
};

export class APIRequestError extends Error {
	constructor(
		public status: number = 400,
		public json: APIResponse = { message: 'Invalid request', success: false }
	) {
		super(JSON.stringify(json));
		this.status = status;
		this.json = json;
	}
}
