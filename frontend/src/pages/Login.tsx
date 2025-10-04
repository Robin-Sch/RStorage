import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { APIResponse, APITOTPResponse } from '../types';

const LoginForm = () => {
	const navigate = useNavigate();

	const [activeForm, setActiveForm] = useState('login');
	const [response, setResponse] = useState('');
	const [totpSecret, setTotpSecret] = useState('');
	const [qrCodeData, setQrCodeData] = useState('');

	const { register: loginRegister, handleSubmit: handleLoginSubmit } = useForm();
	const { register: regRegister, handleSubmit: handleRegSubmit } = useForm();
	const { register: verifyRegister, handleSubmit: handleVerifySubmit } = useForm();

	const changeForm = (form) => {
		setActiveForm(form);
		setResponse('');
	};

	const makeRequest = async (action, data): Promise<APIResponse | APITOTPResponse> => {
		try {
			const res = await fetch(`/api/users/${action}`, {
				method: 'POST',
				body: JSON.stringify(data),
				headers: { 'Content-Type': 'application/json' },
			});
			if (!res.ok) throw new Error(`Received status code: ${res.status}`);

			const json = (await res.json()) as APIResponse | APITOTPResponse;
			if (!json.success) setResponse(json.message);

			return json;
		} catch (e) {
			console.error(e);
			setResponse('There are problems connecting to the server!');
			return { message: 'There are problems connecting to the server!', success: false };
		}
	};

	const login = async (data) => {
		const json = await makeRequest('login', data);
		if (json.success) navigate('/dashboard');
	};

	const register = async (data) => {
		const json = await makeRequest('register', data);
		if (json.success) {
			if (data.totp && 'secret' in json) {
				setTotpSecret(`Your secret is: ${json.secret}`);
				setQrCodeData(`otpauth://totp/RStorage?secret=${json.secret}`);
				setActiveForm('verify-totp');
			} else navigate('/dashboard');
		}
	};

	const verify = async (data) => {
		const json = await makeRequest('totp-verify', data);
		if (json.success) navigate('/dashboard');
	};

	return (
		<div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
			{/* Login Form */}
			<form
				onSubmit={handleLoginSubmit(login)}
				className={`w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 mb-6 ${activeForm === 'login' ? 'block' : 'hidden'}`}
			>
				<input
					type="text"
					{...loginRegister('username', { required: true })}
					placeholder="Username"
					className="w-full px-4 py-3 mb-4 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<input
					type="password"
					{...loginRegister('password', { required: true })}
					placeholder="Password"
					className="w-full px-4 py-3 mb-4 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<input
					type="number"
					{...loginRegister('token')}
					placeholder="2FA token (optional)"
					className="w-full px-4 py-3 mb-6 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<button type="submit" className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 mb-4">
					Login
				</button>
				<button
					type="button"
					onClick={() => changeForm('register')}
					className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition duration-200"
				>
					Register instead?
				</button>
			</form>

			{/* Register Form */}
			<form
				onSubmit={handleRegSubmit(register)}
				className={`w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 mb-6 ${activeForm === 'register' ? 'block' : 'hidden'}`}
			>
				<input
					type="text"
					{...regRegister('username', { required: true })}
					placeholder="Username"
					className="w-full px-4 py-3 mb-4 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<input
					type="password"
					{...regRegister('password', { required: true })}
					placeholder="Password"
					className="w-full px-4 py-3 mb-4 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<label className="flex items-center mb-6 text-gray-300">
					<input type="checkbox" {...regRegister('totp')} className="mr-2 h-5 w-5 text-blue-600 rounded focus:ring-blue-500" />
					Enable 2FA?
				</label>
				<button type="submit" className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 mb-4">
					Register
				</button>
				<button
					type="button"
					onClick={() => changeForm('login')}
					className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition duration-200"
				>
					Login instead?
				</button>
			</form>

			{/* 2FA Verification Form */}
			<form
				onSubmit={handleVerifySubmit(verify)}
				className={`w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 mb-6 ${activeForm === 'verify-totp' ? 'block' : 'hidden'}`}
			>
				<p className="text-white mb-4">Scan the QR code below or enter the secret manually in your Authenticator app</p>
				<p className="text-white mb-4">{totpSecret}</p>
				{qrCodeData && (
					<div className="flex justify-center mb-6">
						<QRCodeSVG value={qrCodeData} className="rounded-lg border border-gray-600" />
					</div>
				)}
				<input
					type="number"
					{...verifyRegister('token', { required: true })}
					placeholder="TOTP Code"
					className="w-full px-4 py-3 mb-6 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<button type="submit" className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200">
					Verify
				</button>
			</form>

			{/* Error Message */}
			{response && <p className="text-red-500 text-center max-w-md w-full mb-6">{response}</p>}
		</div>
	);
};

export default LoginForm;
