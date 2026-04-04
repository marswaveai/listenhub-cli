import http from 'node:http';
import type {AddressInfo} from 'node:net';

type CallbackResult = {code: string};

const loginTimeoutMs = 5 * 60 * 1000; // 5 minutes

export async function startCallbackServer(): Promise<{
	port: number;
	waitForCode: () => Promise<CallbackResult>;
	close: () => void;
}> {
	let resolveCode!: (result: CallbackResult) => void;
	let rejectCode!: (error: Error) => void;
	const codePromise = new Promise<CallbackResult>((resolve, reject) => {
		resolveCode = resolve;
		rejectCode = reject;
	});

	const timeout = setTimeout(() => {
		rejectCode(new Error('Login timed out after 5 minutes. Please try again.'));
	}, loginTimeoutMs);

	const server = http.createServer((request, response) => {
		const url = new URL(request.url!, 'http://localhost');
		const code = url.searchParams.get('code');
		const error = url.searchParams.get('error');

		if (error) {
			const description = url.searchParams.get('error_description') ?? error;
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.end(
				`<html><body><h1>Login failed</h1><p>${description}</p></body></html>`,
			);
			clearTimeout(timeout);
			rejectCode(new Error(`OAuth error: ${description}`));
			return;
		}

		if (code) {
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.end(
				'<html><body><h1>Login successful!</h1><p>You can close this tab.</p></body></html>',
			);
			clearTimeout(timeout);
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
			clearTimeout(timeout);
			server.close();
		},
	};
}
