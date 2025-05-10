import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { APINodeResponse, APIResponse } from '../../types';

const Node = () => {
	const { id } = useParams();
	const navigate = useNavigate();

	const [node, setNode] = useState({
		ip: '',
		port: '',
		ca: '',
	});

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [response, setResponse] = useState('');

	const fetchNode = async () => {
		try {
			const res = await fetch(`/api/nodes/${id}`);
			if (res.status === 401) {
				navigate('/login');
				return;
			} else if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APINodeResponse;
			if (!json.success) throw new Error(json.message);

			setNode(json.node);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		fetchNode();
	}, []);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setNode((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const editNode = async () => {
		try {
			const res = await fetch(`/api/nodes/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(node),
			});
			if (res.status === 401) {
				navigate('/login');
				return;
			} else if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APIResponse;
			if (!json.success) throw new Error(json.message);
			navigate(0);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		}
	};

	const deleteNode = async () => {
		try {
			const res = await fetch(`/api/nodes/${id}`, {
				method: 'DELETE',
			});
			if (res.status === 401) {
				navigate('/login');
				return;
			} else if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APIResponse;
			if (!json.success) throw new Error(json.message);
			navigate('/');
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		}
	};

	if (loading) return <div className="text-center py-8">Loading node details...</div>;
	if (error) return <div className="text-red-500 text-center py-8">Error: {error}</div>;

	return (
		<div className="min-h-screen bg-gray-100 p-6">
			<div className="max-w-6xl mx-auto">
				<button onClick={() => navigate('/')} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
					Home
				</button>

				<div className="bg-white rounded-lg shadow-md p-6">
					<h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Node {id}</h1>

					<div className="overflow-x-auto">
						<table className="min-w-full bg-white border border-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node IP</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Port</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Public Key</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className="px-4 py-2 border-b border-gray-200">
										<input
											type="text"
											name="ip"
											value={node.ip}
											onChange={handleInputChange}
											placeholder="IP"
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
											required
										/>
									</td>
									<td className="px-4 py-2 border-b border-gray-200">
										<input
											type="number"
											name="port"
											value={node.port}
											onChange={handleInputChange}
											placeholder="Port"
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
											required
										/>
									</td>
									<td className="px-4 py-2 border-b border-gray-200">
										<textarea
											name="ca"
											value={node.ca}
											onChange={handleInputChange}
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
											rows={4}
											required
										/>
									</td>
									<td className="px-4 py-2 border-b border-gray-200 space-x-2">
										<button onClick={editNode} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
											Save
										</button>
										<button onClick={deleteNode} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
											Delete
										</button>
									</td>
								</tr>
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

export default Node;
