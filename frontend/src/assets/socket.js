const socket = io();

socket.on('message', (msg) => {
	return showMessage(msg);
});

socket.on('reload', () => {
	return window.location.reload();
});

socket.on('download', (data) => {
	document.getElementById('main').style = 'display: none;';
	document.getElementById('decryption').style = 'display: block;';

	showMessage(`[download] [client-side] ${data.path}${data.name} waiting for decryption key`);

	const button = document.getElementById('decrypt');
	button.onclick = () => {
		const key = document.getElementById('decryption-key').value;
		if (!key) return alert('You need to enter a decryption key.');
		document.getElementById('decryption-key').value = '';

		showMessage(`[download] [client-side] ${data.path}${data.name} decrypting`);

		const content = new TextDecoder('utf-8').decode(new Uint8Array(data.content));

		try {
			const decrypted = CryptoJS.AES.decrypt(content, key).toString(CryptoJS.enc.Utf8);
			showMessage(`[download] [client-side] ${data.path}${data.name} decrypted`);

			document.getElementById('main').style = 'display: block;';
			document.getElementById('decryption').style = 'display: none;';

			socket.emit('downloading', false);

			return download(decrypted, data.name);
		} catch (e) {
			return showMessage(`[download] [client-side] ${data.path}${data.name} failed (wrong decryption key?)`);
		}
	};
});

socket.on('error', (err) => {
	return (document.getElementById('response').innerHTML = err);
});

socket.on('upload-percentage', (percentage) => {
	const el = document.getElementById('percentage-upload');
	if (el) el.innerHTML = `${percentage}%`;
});
