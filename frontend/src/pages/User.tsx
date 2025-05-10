import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { APIResponse, APIUserResponse, User } from '../../types';

const UserPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();

	const [user, setUser] = useState<User>({
		username: '',
		password: '',
		permissions: '',
	});

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [response, setResponse] = useState('');

	const fetchUser = async () => {
		try {
			const res = await fetch(`/api/users/${id}`);
			if (res.status === 401) {
				navigate('/login');
				return;
			} else if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as APIUserResponse;
			if (!json.success) throw new Error(json.message);

			setUser(json.user);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		fetchUser();
	}, []);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setUser((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const editUser = async () => {
		try {
			const res = await fetch(`/api/users/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(user),
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

	const deleteUser = async () => {
		try {
			const res = await fetch(`/api/users/${id}`, {
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
					<h1 className="text-2xl font-bold text-gray-800 mb-6">Edit User {id}</h1>

					<div className="overflow-x-auto">
						<table className="min-w-full bg-white border border-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className="px-4 py-2 border-b border-gray-200">
										<input
											type="text"
											name="username"
											value={user.username}
											onChange={handleInputChange}
											placeholder="Username"
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
											required
										/>
									</td>
									<td className="px-4 py-2 border-b border-gray-200">
										<input
											type="password"
											name="password"
											value={user.password}
											onChange={handleInputChange}
											placeholder="New password (empty = keep current)"
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
										/>
									</td>
									<td className="px-4 py-2 border-b border-gray-200">
										<input
											type="number"
											name="permissions"
											value={user.permissions}
											onChange={handleInputChange}
											placeholder="Permissions"
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
											required
										/>
									</td>
									<td className="px-4 py-2 border-b border-gray-200 space-x-2">
										<button onClick={editUser} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
											Save
										</button>
										<button onClick={deleteUser} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
											Delete
										</button>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
									<path
										fillRule="evenodd"
										d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div className="ml-3">
								<h2 className="text-lg font-bold text-yellow-800">Important Security Notice</h2>
								<p className="mt-1 text-yellow-700">
									Do not change permissions unless you know and understand what you are doing! You are responsible if anything happens if you change the default
									permissions!
								</p>
								<p className="mt-1 text-yellow-700">
									You should not give others access to your panel, because every file uploaded (by you) is accessible (with the correct permissions)!
								</p>
							</div>
						</div>
					</div>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-gray-800 mb-2">Permissions Guide</h3>
						<p className="mb-2">Permissions is an integer containing 3 numbers:</p>
						<ol className="list-decimal pl-5 mb-4 space-y-1">
							<li>Files permissions (view/download/upload/delete)</li>
							<li>Nodes permissions (view/edit/add/delete)</li>
							<li>Users permissions (view/edit/delete)</li>
						</ol>

						<div className="overflow-x-auto">
							<table className="min-w-full bg-white border border-gray-200 mb-4">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-4 py-2 text-center">0</th>
										<th className="px-4 py-2 text-center">1</th>
										<th className="px-4 py-2 text-center">2</th>
										<th className="px-4 py-2 text-center">3</th>
										<th className="px-4 py-2 text-center">4</th>
										<th className="px-4 py-2 text-center">5</th>
										<th className="px-4 py-2 text-center">6</th>
										<th className="px-4 py-2 text-center">7</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td className="px-4 py-2 border text-center">View files</td>
										<td className="px-4 py-2 border text-center">View + Download</td>
										<td className="px-4 py-2 border text-center">View + Upload</td>
										<td className="px-4 py-2 border text-center">View + Download + Upload</td>
										<td className="px-4 py-2 border text-center">View + Delete</td>
										<td className="px-4 py-2 border text-center">View + Download + Delete</td>
										<td className="px-4 py-2 border text-center">View + Upload + Delete</td>
										<td className="px-4 py-2 border text-center">Full access</td>
									</tr>
									<tr>
										<td className="px-4 py-2 border text-center">View nodes</td>
										<td className="px-4 py-2 border text-center">View + Edit</td>
										<td className="px-4 py-2 border text-center">View + Add</td>
										<td className="px-4 py-2 border text-center">View + Edit + Add</td>
										<td className="px-4 py-2 border text-center">View + Delete</td>
										<td className="px-4 py-2 border text-center">View + Edit + Delete</td>
										<td className="px-4 py-2 border text-center">View + Add + Delete</td>
										<td className="px-4 py-2 border text-center">Full access</td>
									</tr>
									<tr>
										<td className="px-4 py-2 border text-center">View users</td>
										<td className="px-4 py-2 border text-center">View + Edit</td>
										<td className="px-4 py-2 border text-center">-</td>
										<td className="px-4 py-2 border text-center">-</td>
										<td className="px-4 py-2 border text-center">View + Delete</td>
										<td className="px-4 py-2 border text-center">View + Edit + Delete</td>
										<td className="px-4 py-2 border text-center">-</td>
										<td className="px-4 py-2 border text-center">-</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div className="bg-blue-50 border-l-4 border-blue-400 p-4">
							<h4 className="font-semibold text-blue-800">Recommended Permission Sets:</h4>
							<ul className="mt-2 space-y-2">
								<li>
									<strong>Admin (777):</strong> Full access to files, nodes, and users
								</li>
								<li>
									<strong>Collaborator (300):</strong> View + download + upload files, view nodes and users
								</li>
								<li>
									<strong>Viewer (000):</strong> View-only access to files, nodes, and users
								</li>
							</ul>
						</div>
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

export default UserPage;
