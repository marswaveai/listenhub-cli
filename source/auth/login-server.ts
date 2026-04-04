import http from 'node:http';
import type {AddressInfo} from 'node:net';

type CallbackResult = {code: string};

export async function startCallbackServer(): Promise<{
	port: number;
	waitForCode: () => Promise<CallbackResult>;
	close: () => void;
}> {
	let resolveCode!: (result: CallbackResult) => void;
	const codePromise = new Promise<CallbackResult>((resolve) => {
		resolveCode = resolve;
	});

	const server = http.createServer((request, response) => {
		const url = new URL(request.url!, 'http://localhost');
		const code = url.searchParams.get('code');

		if (code) {
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.end(
				'<html><body><h1>Login successful!</h1><p>You can close this tab.</p></body></html>',
			);
			resolveCode({code});
		} else {
			response.writeHead(400, {'Content-Type': 'text/plain'});
			response.end('Missing code parameter');
		}
	});

	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve);
	});

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- server.listen on '127.0.0.1' always returns AddressInfo
	const {port} = server.address() as AddressInfo;

	return {
		port,
		waitForCode: async () => codePromise,
		close() {
			server.close();
		},
	};
}
