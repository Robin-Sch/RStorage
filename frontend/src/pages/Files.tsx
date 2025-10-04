import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSearchParams, useNavigate } from 'react-router-dom';

// import file_download from '../assets/files/file_download.svg';
import file_upload from '../assets/files/file_upload.svg';
import file_svg from '../assets/files/file.svg';
import folder_create from '../assets/files/folder_create.svg';
// import folder_download from '../assets/files/folder_download.svg';
// import folder_locked from '../assets/files/folder_locked.svg';
// import folder_upload from '../assets/files/folder_upload.svg';
import folder from '../assets/files/folder.svg';

import { APIFilesResponse, APIResponse, Directory, EncryptionStream, RFile } from '../types';

const Files = () => {
	const [searchParams] = useSearchParams();
	const path = searchParams.get('path') || '/';
	const navigate = useNavigate();

	const [files, setFiles] = useState<RFile[]>([]);
	const [directories, setDirectories] = useState<Directory[]>([]);

	const [loading, setLoading] = useState(true);
	const [response, setResponse] = useState('');
	const [messages, setMessages] = useState<string[]>([]);

	const [uploadPercentage, setUploadPercentage] = useState<number | null>(null);

	const [directoryName, setDirectoryName] = useState(path);
	const [decryptionKey, setDecryptionKey] = useState('');

	const fetchFiles = async () => {
		try {
			const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
			if (res.status === 401) {
				navigate('/login');
				return;
			}

			const json = (await res.json()) as APIFilesResponse;
			if (!json.success) setResponse(json.message);
			else {
				setFiles(json.files);
				setDirectories(json.directories);
			}
		} catch (e) {
			console.error(e);
			setResponse('Unknown error (see browser console)');
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		fetchFiles();
	}, []);

	const moveOneBack = () => {
		const newPath = path.split('/').slice(0, -1).join('/') || '/';
		navigate(`/files?path=${encodeURIComponent(newPath)}`);
	};

	const onDrop = useCallback(async (files) => {
		if (files.length === 0) return;
		const file: File = files[0];

		const password = prompt('Please enter a password for the file');
		if (!password) return;
		const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
		const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password

		const key = await crypto.subtle.importKey('raw', pwHash, 'AES-GCM', false, ['encrypt']);

		// setUploadPercentage(0);
		// setMessages([`[upload] [client-side] ${path}${file.name} encrypting`, ...messages]);

		const inputStream = file.stream();
		const outputStream = inputStream.pipeThrough(new EncryptionStream(key));

		try {
			// TODO: Instead of converting to blob, we should stream instead
			const blob = new Blob([
				await outputStream
					.getReader()
					.read()
					.then((r) => r.value),
			]);

			const res = await fetch(`/api/files/upload?path=${encodeURIComponent(path)}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					'X-Filename': file.name,
					'X-Size': blob.size.toString(),
				},
				body: blob,
			});

			if (res.status === 401) {
				navigate('/login');
				return;
			}

			const json = (await res.json()) as APIResponse;
			if (!json.success) throw new Error(json.message);
			else navigate(0);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) setResponse(e.message);
			else setResponse('Unknown error (see browser console)');
		}
	}, []);
	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		multiple: false,
	});

	const handleDirCreate = async () => {
		navigate(`/files?path=${directoryName}`);
		// TODO: create
	};

	const handleFileDelete = async (path, name) => {
		try {
			const res = await fetch(`/api/files/delete?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`, {
				method: 'POST',
			});
			if (res.status === 401) {
				navigate('/login');
				return;
			}

			const json = (await res.json()) as APIResponse;
			console.log(json);

			if (!json.success) setResponse(json.message);
			else navigate(0);
		} catch (e) {
			console.error(e);
			setResponse('Unknown error (see browser console)');
		}
	};

	const handleFileDownload = async (path, name) => {
		// TODO
		// socket.emit('download', { path, name });
	};

	if (loading) return <div className="text-center py-8">Loading files...</div>;

	return (
		<div className="min-h-screen bg-gray-100 p-6">
			<div className="max-w-6xl mx-auto">
				<button onClick={() => navigate('/')} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
					Home
				</button>

				<div className="bg-white rounded-lg shadow-md p-6">
					<h1 className="text-2xl font-bold text-gray-800 mb-6">File Manager</h1>

					<div className="overflow-x-auto">
						{/*  Upload */}
						<div
							className={`mb-8 ${isDragActive ? 'bg-blue-50' : 'bg-gray-50'} p-6 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors`}
							{...getRootProps()}
						>
							<div className="flex items-center space-x-4 mb-4">
								<div className="p-3 bg-blue-100 rounded-full">
									<img src={file_upload} width="24" height="24" alt="Upload" className="text-blue-600" />
								</div>
								<div className="flex-1">
									<h3 className="font-medium text-gray-800">Upload Files</h3>
									<p className="text-sm text-gray-500">Drag and drop files here or click to browse</p>
								</div>
							</div>

							<div className="flex space-x-2">
								<input {...getInputProps()} id="file" type="file" className="hidden" />
								<button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md flex items-center justify-center">
									<span>Upload</span>
									{uploadPercentage && <span className="ml-2 text-sm">{uploadPercentage}%</span>}
								</button>
							</div>
						</div>

						{/* Create Directory */}
						<div className="bg-gray-50 p-6 rounded-lg mb-8">
							<div className="flex items-center space-x-4 mb-4">
								<div className="p-3 bg-blue-100 rounded-full">
									<img src={folder_create} width="24" height="24" alt="Create folder" />
								</div>
								<div className="flex-1">
									<h3 className="font-medium text-gray-800">Create Directory</h3>
									<p className="text-sm text-gray-500">Enter the directory path</p>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="md:col-span-2">
									<input
										type="text"
										value={directoryName}
										onChange={(e) => setDirectoryName(e.target.value)}
										placeholder="e.g., /documents/projects"
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									/>
								</div>
								<button onClick={handleDirCreate} className="px-4 py-2 text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors shadow-md">
									Create
								</button>
							</div>
						</div>

						<table className="min-w-full bg-white border border-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" width="25"></th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
									<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Download</th>
								</tr>
							</thead>
							<tbody>
								{path !== '/' && (
									<tr>
										<td className="px-4 py-2 border-b border-gray-200">
											<img src={folder} width="25" height="25" alt="Folder" />
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button onClick={moveOneBack} className="text-blue-600 hover:text-blue-800">
												../
											</button>
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button disabled className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed">
												Delete
											</button>
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button disabled className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed">
												Download
											</button>
										</td>
									</tr>
								)}

								{directories.map((directory, index) => (
									<tr key={`dir-${index}`}>
										<td className="px-4 py-2 border-b border-gray-200">
											<img src={folder} width="25" height="25" alt="Folder" />
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button onClick={() => navigate(`/files?path=${encodeURIComponent(directory.path)}`)} className="text-blue-600 hover:text-blue-800">
												{directory.path}
											</button>
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button disabled className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed">
												Delete
											</button>
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button disabled className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed">
												Download
											</button>
										</td>
									</tr>
								))}

								{files.map((file, index) => (
									<tr key={`file-${index}`}>
										<td className="px-4 py-2 border-b border-gray-200">
											<img src={file_svg} width="25" height="25" alt="File" />
										</td>
										<td className="px-4 py-2 border-b border-gray-200">{file.name}</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button
												onClick={() => handleFileDelete(path, file.name)}
												className="px-4 py-2 text-white rounded-lg bg-red-600 hover:bg-red-800 transition-colors shadow-md"
											>
												Delete
											</button>
										</td>
										<td className="px-4 py-2 border-b border-gray-200">
											<button
												onClick={() => handleFileDownload(path, file.name)}
												className="px-4 py-2 text-white rounded-lg bg-green-600 hover:bg-green-800 transition-colors shadow-md"
											>
												Download
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="mt-6">
						<div className="flex items-center space-x-2 mb-4">
							<input
								type="password"
								placeholder="Decryption key"
								value={decryptionKey}
								onChange={(e) => setDecryptionKey(e.target.value)}
								className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
							/>
						</div>

						{response && (
							<div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
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

						{messages.length > 0 && (
							<div className="bg-green-50 border-l-4 border-green-400 p-4">
								<div className="flex">
									<div className="flex-shrink-0">
										<svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
									<div className="ml-3">
										<p className="text-sm text-green-700">{messages}</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Files;
