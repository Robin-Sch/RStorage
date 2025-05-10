export type Node = {
	id: string;
	connected: boolean;
	ip: string;
	port: string;
	ca: string;
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
