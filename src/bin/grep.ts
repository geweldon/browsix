'use strict';

import * as fs from 'fs';
import * as readline from 'readline';
import {format} from 'util';

function log(fmt: string, ...args: any[]): void {
	let cb: Function = undefined;
	if (args.length && typeof args[args.length-1] === 'function') {
		cb = args[args.length-1];
		args = args.slice(0, -1);
	}
	let prog = process.argv[1].split('/').slice(-1);
	let msg = prog + ': ' + format.apply(undefined, [fmt].concat(args)) + '\n';

	if (cb)
		process.stderr.write(msg, cb);
	else
		process.stderr.write(msg);
}

function parseArgs(args: string[], handlers: {[n: string]: Function}): [string[], boolean] {
	let ok = true;
	let positionalArgs: string[] = args.filter((arg) => arg.substring(0, 1) !== '-');
	args = args.filter((arg) => arg.substring(0, 1) === '-');

	let errs = 0;
	function done(): void {
		errs--;
		if (!errs)
			process.exit(1);
	}
	function error(...args: any[]): void {
		errs++;
		ok = false;
		// apply the arguments we've been given to log, and
		// append our own callback.
		log.apply(this, args.concat([done]));
	}
	function usage(): void {
		errs++;
		let prog = process.argv[1].split('/').slice(-1);
		let flags = Object.keys(handlers).concat(['h']).sort().join('');
		let msg = format('usage: %s [-%s] ARGS\n', prog, flags);
		process.stderr.write(msg, done);
	}

	outer:
	for (let i = 0; i < args.length; i++) {
		let argList = args[i].slice(1);
		if (argList.length && argList[0] === '-') {
			error('unknown option "%s"', args[i]);
			continue;
		}
		for (let j = 0; j < argList.length; j++) {
			let arg = argList[j];
			if (handlers[arg]) {
				handlers[arg]();
			} else if (arg === 'h') {
				ok = false;
				break outer;
			} else {
				error('invalid option "%s"', arg);
			}
		}
	}

	if (!ok) usage();

	return [positionalArgs, ok];
}


// Recursively read each input and write it to the specified output,
// only moving onto the next input when EOF is reached.  Each file is
// a node stream object - which means that we consume it by adding 2
// event listeners, the first for when there is data available, and
// secondly for when we've reached EOF.
function grep(pattern: string, inputs: NodeJS.ReadableStream[], output: NodeJS.WritableStream, code: number): void {
	if (!inputs || !inputs.length) {
		process.exit(code);
		return;
	}

	let re = new RegExp(pattern, "g");
	let current = inputs[0];
	inputs = inputs.slice(1);

	if (!current) {
		// use setTimeout to avoid a deep stack as well as
		// cooperatively yield
		setTimeout(grep, 0, pattern, inputs, output, code);
		return;
	}

	current.on('readable', function(): void {
		let rl = readline.createInterface({
			input: current,
			output: null
		});

		rl.on('line', (line: string) => {
			//console.log(line);
			//console.log(line.match(re));
			if (line.match(re)) {
				output.write(line + '\n');
			}
		});
	});

	current.on('end', function(): void {
		// use setTimeout to avoid a deep stack as well as
		// cooperatively yield
		setTimeout(grep, 0, inputs, output, code);
	});
}

function main(): void {
	let [args, ok] = parseArgs(process.argv.slice(2), {});
	if (!ok)
		return;

	// exit code to use - if we fail to open an input file it gets
	// set to 1 below.
	let code = 0;

	if (!args.length) {
		parseArgs(['-h'], {});
		return;
	}

	let pattern = args[0];
	args = args.slice(1);
	if (!args.length)
		args = ['-'];
	let files: NodeJS.ReadableStream[] = [];
	let opened = 0;
	// use map instead of a for loop so that we easily get
	// the tuple of (path, i) on each iteration.
	args.map(function(path, i): void {
		if (path === '-') {
			files[i] = process.stdin;
			// if we've opened all of the files, pipe them to
			// stdout.
			if (++opened === args.length)
				setTimeout(grep, 0, pattern, files, process.stdout, code);
			return;
		}
		fs.open(path, 'r', function(err: any, fd: any): void {
			if (err) {
				// if we couldn't open the
				// specified file we should
				// print a message but not
				// exit early - we need to
				// process as many inputs as
				// we can.
				files[i] = null;
				code = 1;
				log(err.message);
			} else {
				files[i] = fs.createReadStream(path, {fd: fd});
			}
			// if we've opened all of the files,
			// pipe them to stdout.
			if (++opened === args.length)
				setTimeout(grep, 0, pattern, files, process.stdout, code);
		});
	});
}

main();
