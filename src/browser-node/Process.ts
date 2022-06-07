'use strict';
import { syscall, SyscallCallback } from './syscall';
import { Environment, _bindings } from './browser-node';

export class Process {
	argv: string[];
	env: Environment;
	pwd: string;
	queue: any[] = [];
	draining: boolean = false;

	stdin: any;
	stdout: any;
	stderr: any;

	constructor(argv: string[], environ: Environment) {
		this.argv = argv;
		this.env = environ;
	}

	init(cb: SyscallCallback): void {
		// TODO: getcwd has to be called first, as node makes
		// access to it syncronous, and with our
		// message-passing syscall interface every syscall is
		// async.  This has to be kept up to date with any
		// calls to chdir(2).
		syscall.getcwd((cwd: string) => {
			this.pwd = cwd;
			setTimeout(cb);
		});
	}

	cwd(): string {
		return this.pwd;
	}

	exit(code: number): void {
		// FIXME: we should make sure stdout and stderr are
		// flushed.
		//this.stdout.end();
		//this.stderr.end();
		// ending the above streams I think calls close() via
		// nextTick, if exit isn't called via setTimeout under
		// node it deadlock's the WebWorker-threads :\
		setTimeout(function (): void { syscall.exit(code); }, 0);
	}

	binding(name: string): any {
		if (!(name in _bindings)) {
			console.log('TODO: unimplemented binding ' + name);
			(<any>console).trace('TODO: unimplemented binding ' + name);
			return null;
		}

		return _bindings[name];
	}

	// this is from acorn - https://github.com/marijnh/acorn
	nextTick(fun: any, ...args: any[]): void {
		this.queue.push([fun, args]);
		if (!this.draining) {
			setTimeout(this.drainQueue.bind(this), 0);
		}
	}

	// this is from acorn - https://github.com/marijnh/acorn
	private drainQueue(): void {
		if (this.draining) {
			return;
		}
		this.draining = true;
		let currentQueue: any[];
		let len = this.queue.length;
		while (len) {
			currentQueue = this.queue;
			this.queue = [];
			let i = -1;
			while (++i < len) {
				let [fn, args] = currentQueue[i];
				fn.apply(this, args);
			}
			len = this.queue.length;
		}
		this.draining = false;
	}
}
