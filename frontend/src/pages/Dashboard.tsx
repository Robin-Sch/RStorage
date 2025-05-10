import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APINodesResponse, APIResponse, APIUsersResponse, Node, User } from '../../types';

const Dashboard = () => {
	const navigate = useNavigate();

	const [nodes, setNodes] = useState<Node[]>([]);
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const [ip, setIp] = useState('127.0.0.1');
	const [port, setPort] = useState('3001');
	const [ca, setCa] = useState(`-----BEGIN CERTIFICATE-----
	----END CERTIFICATE-----`);
	const [response, setResponse] = useState('');

	const createNode = async () => {
		try {
			const res = await fetch('/api/nodes/create', {
				method: 'POST',
				body: JSON.stringify({ ip, port, ca }),
				headers: { 'Content-Type': 'application/json' },
			});
			if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APIResponse;
			if (!json.success) throw new Error(json.message);
			else fetchNodes();
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		}
	};

	// Make sure we are logged in
	const fetchMe = async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/users/me');
			if (res.status === 401) {
				navigate('/login');
				return;
			}
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		fetchMe();
	}, []);

	const fetchNodes = async () => {
		try {
			const res = await fetch('/api/nodes');
			if (res.status === 401) {
				navigate('/login');
				return;
			} else if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APINodesResponse;
			if (!json.success) throw new Error(json.message);

			setNodes(json.nodes);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		}
	};
	const fetchUsers = async () => {
		try {
			const res = await fetch('/api/users');
			if (res.status === 401) {
				navigate('/login');
				return;
			} else if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APIUsersResponse;
			if (!json.success) throw new Error(json.message);

			setUsers(json.users);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		}
	};
	useEffect(() => {
		if (!loading) {
			fetchNodes();
			fetchUsers();
		}
	}, [loading]);

	if (loading) return <div className="text-center py-8">Loading...</div>;
	if (error) return <div className="text-red-500 text-center py-8">Error: {error}</div>;

	return (
		<div className="min-h-screen bg-gray-100 p-6">
			<div className="max-w-6xl mx-auto">
				<h1 className="text-3xl font-bold text-gray-800 mb-6">RStorage Panel</h1>

				<div className="mb-8">
					<button onClick={() => navigate('/files?path=/')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
						Browse files
					</button>
				</div>

				<div className="bg-white rounded-lg shadow-md p-6 mb-8">
					<h2 className="text-xl font-semibold text-gray-700 mb-4">Nodes</h2>
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node ID</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connected?</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{nodes.map((node) => (
									<tr key={node.id}>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{node.id}</td>
										<td className={`px-6 py-4 whitespace-nowrap text-sm ${node.connected ? 'text-green-600' : 'text-red-600'}`}>
											{node.connected ? 'Yes' : 'No'}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											<button onClick={() => navigate(`/node/${node.id}`)} className="text-indigo-600 hover:text-indigo-900">
												Edit
											</button>
										</td>
									</tr>
								))}
								<tr>
									<td colSpan={3} className="px-6 py-4 whitespace-nowrap">
										<div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
											<input
												type="text"
												value={ip}
												onChange={(e) => setIp(e.target.value)}
												placeholder="IP"
												className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
												required
											/>
											<input
												type="number"
												value={port}
												onChange={(e) => setPort(e.target.value)}
												placeholder="Port"
												className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
												required
											/>
											<textarea
												value={ca}
												onChange={(e) => setCa(e.target.value)}
												className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 flex-grow"
												required
												rows={3}
											/>
											<button onClick={createNode} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors">
												Add Node
											</button>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div className="bg-white rounded-lg shadow-md p-6 mb-8">
					<h2 className="text-xl font-semibold text-gray-700 mb-4">Users</h2>
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{users.map((user) => (
									<tr key={user.id}>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.username}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.permissions}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											<button onClick={() => navigate(`/user/${user.id}`)} className="text-indigo-600 hover:text-indigo-900">
												Edit
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{response && (
					<div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
									<path
										fillRule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div className="ml-3">
								<p className="text-sm text-red-700">{response}</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default Dashboard;
