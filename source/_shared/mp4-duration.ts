import {open} from 'node:fs/promises';

export async function getMp4Duration(filePath: string): Promise<number> {
	const file = await open(filePath, 'r');
	try {
		const moovOffset = await findAtom(file, 'moov', 0, await fileSize(file));
		if (moovOffset === undefined) {
			throw new Error(`Cannot read video duration: moov atom not found in ${filePath}`);
		}

		const moovHeader = await readAtomHeader(file, moovOffset);
		const moovEnd = moovOffset + moovHeader.size;
		const mvhdOffset = await findAtom(file, 'mvhd', moovOffset + 8, moovEnd);
		if (mvhdOffset === undefined) {
			throw new Error(`Cannot read video duration: mvhd atom not found in ${filePath}`);
		}

		const dataOffset = mvhdOffset + 8;

		const versionBuf = Buffer.alloc(1);
		await file.read(versionBuf, 0, 1, dataOffset);
		const version = versionBuf[0]!;

		let timescale: number;
		let duration: bigint;

		if (version === 0) {
			const buf = Buffer.alloc(8);
			await file.read(buf, 0, 8, dataOffset + 4 + 8);
			timescale = buf.readUInt32BE(0);
			duration = BigInt(buf.readUInt32BE(4));
		} else if (version === 1) {
			const buf = Buffer.alloc(12);
			await file.read(buf, 0, 12, dataOffset + 4 + 16);
			timescale = buf.readUInt32BE(0);
			duration = buf.readBigUInt64BE(4);
		} else {
			throw new Error(`Cannot read video duration: unsupported mvhd version ${String(version)}`);
		}

		if (timescale === 0) {
			throw new Error(`Cannot read video duration: timescale is 0`);
		}

		return Math.round(Number(duration) / timescale);
	} finally {
		await file.close();
	}
}

interface AtomHeader {
	size: number;
	type: string;
}

async function readAtomHeader(
	file: Awaited<ReturnType<typeof open>>,
	offset: number,
): Promise<AtomHeader> {
	const buf = Buffer.alloc(8);
	const {bytesRead} = await file.read(buf, 0, 8, offset);
	if (bytesRead < 8) {
		return {size: 0, type: ''};
	}

	const size = buf.readUInt32BE(0);
	const type = buf.toString('ascii', 4, 8);
	return {size, type};
}

async function findAtom(
	file: Awaited<ReturnType<typeof open>>,
	target: string,
	start: number,
	end: number,
): Promise<number | undefined> {
	let offset = start;
	while (offset < end) {
		const header = await readAtomHeader(file, offset); // eslint-disable-line no-await-in-loop
		if (header.size === 0) break;
		if (header.type === target) return offset;
		offset += header.size;
	}

	return undefined;
}

async function fileSize(file: Awaited<ReturnType<typeof open>>): Promise<number> {
	const stat = await file.stat();
	return stat.size;
}
