# RStorage

<div style="border:1px solid #c2c2c2;background-color:#ffffcc;padding:15px;margin:15px;">
	<strong>⚠️ Warning:</strong> RStorage is currently undergoing a re-write and does NOT work.
</div>

RStorage is an encrypted cloud file storage.

To not confuse things, `node`, or `Node` means `rstorage-node` or `RStorage Node`, and `nodejs` means [`node.js`](https://nodejs.org/).

## How does RStorage work?

### Panel

You have **one** panel, which is like the "master". This is meant to be run on your PC, but if you really really really want, it can be run on a server too, but this is not recommended.

You can have one node, but also multiple nodes (this is recommended, the file will be spread over all the connected node(s) (See `PANEL_FORCE_SPREADING` below)).

### Node

You can have as many nodes as you want, and here are the encrypted files stored. These can be run on anything, your PC, a server, a server of your friend etc. etc.. The files are encrypted and the decryption key is only known to the panel. However, you should still secure this.

A node should have a lot of disk storage, as the encrypted files are stored here.

**I'm not taking any responsibilty for lost files, hacked files or any problems with RStorage. You're the owner of your data, not me. This is just a tool to help you.**

You should always keep a (encrypted) backup, and for sensitive files always use something like [gpg](https://gnupg.org/) or another encryption program.

Note: RStorage isn't done yet, and won't function properly. Every update could break your previous installation and (as of right now) it's recommended that you reinstall everything if a new update comes out, as there's no guarantee for backwards compatibility.

You can help by looking at the what has to be done section down below, or search for `TODO` in the code. For new suggestions please open an issue first.

## Installation

Install [nodejs](https://nodejs.org/en/download/) (if not done already previously).

### Frontend+backend
The panel is meant to be installed on your PC. But it *can* be installed on a server too. But that's not recommended.

TODO

Login with username `admin` and password `admin`.

**MAKE SURE TO CHANGE DEFAULT PASSWORD**, but **DO NOT CHANGE THE USERNAME**

### Node
TODO

Copy the certificate printed in console (you need to enter that later in the panel).

## Usage
TODO

To start the panel, or a node, use the `npm run dev` command.

Go to your panel, login, and paste the certificate (of your node's console) (and change the ip/port if you have changed that). If you want to add more nodes, repeat the same steps (installation => copying => pasting).

Play around with `PANEL_MAX_SIZE` in the environment variables if you're getting out of memory crashes (set it lower until you get no crashes anymore while uploading a big file).

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## Environment variables
* PANEL_MAX_SIZE (Default: 8) (in megabytes)
	* This is the maximum size (in megabytes) a (decrypted) file part should be. If set to 8, that means if a file is between 8 and 16 mb, there will be 2 file parts (useful for changing if your server has a lot of memory, or if you want to spread the file more) (the lower it is, the more the file will be spread).

* PANEL_FORCE_SPREADING (Default: true)
	* This will force the spreading of a uploaded file, no matter the size (see option above).

* PANEL_DISABLE_REGISTER (Default: true)
	* This will disable being able to register new accounts.
	* You shouldn't give others people access to your panel, because every file uploaded (by you) is accessable (with the correct permissions (by default, new accounts get 777))! But if you REALLY REALLY REALLY want them to create a new account, it's possible with this variable.

* PANEL_DISABLE_SERVER_ENCRYPTION (Default: false)
	* This will disable the server-side encryption.

* PANEL_PORT (Default: 3000)
	* The port the panel is listening on.

* NODE_COMMONNAME (Default: 127.0.0.1)
	* The IP (or hostname) the node is listening on.
	* Examples: node1.yourdomain.com, yourdomain.com, 1.1.1.1, 192.168.1.1, 127.0.0.1, localhost

* NODE_PORT (Default: 3001)
	* The port the node is listening on.

## License
[MIT](https://choosealicense.com/licenses/mit/)