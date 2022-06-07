'use strict';

import * as chai from 'chai';
import { Boot, Kernel } from '../lib/kernel/kernel';

const expect = chai.expect;

const MINS = 60 * 1000; // milliseconds

const IS_KARMA = typeof window !== 'undefined' && typeof (<any>window).__karma__ !== 'undefined';
const ROOT = IS_KARMA ? '/base/fs/' : '/fs/';

export const name = 'test-tee';

describe('echo hi | tee /a', function(): void {
	this.timeout(10 * MINS);

	let kernel: Kernel = null;

	it('should boot', function(done: Mocha.Done): void {
		Boot('XmlHttpRequest', ['index.json', ROOT, true], function(err: any, freshKernel: Kernel): void {
			expect(err).to.be.null;
			expect(freshKernel).not.to.be.null;
			kernel = freshKernel;
			done();
		});
	});

	it('should run `echo hi | tee`', function(done: Mocha.Done): void {
		let stdout: string = '';
		let stderr: string = '';
		kernel.system('echo hi | tee', onExit, onStdout, onStderr, onHaveStdin);
		function onStdout(pid: number, out: string): void {
			stdout += out;
		}
		function onStderr(pid: number, out: string): void {
			stderr += out;
		}
		function onExit(pid: number, code: number): void {
			try {
				expect(code).to.equal(0);
				expect(stdout).to.equal('hi\n');
				expect(stderr).to.equal('');
				done();
			} catch (e) {
				done(e);
			}
		}
		function onHaveStdin(stdin: any): void {
			this.stdin = stdin;
		}
	});

	it('should run `echo hi | tee`', function(done: Mocha.Done): void {
		let stdout: string = '';
		let stderr: string = '';
		kernel.system('echo hi | tee /greeting', onExit, onStdout, onStderr, onHaveStdin);
		function onStdout(pid: number, out: string): void {
			stdout += out;
		}
		function onStderr(pid: number, out: string): void {
			stderr += out;
		}
		function onExit(pid: number, code: number): void {
			try {
				expect(code).to.equal(0);
				expect(stdout).to.equal('hi\n');
				expect(stderr).to.equal('');
				done();
			} catch (e) {
				done(e);
			}
		}
		function onHaveStdin(stdin: any): void {
			this.stdin = stdin;
		}
	});

	it('should read /greeting', function(done: Mocha.Done): void {
		kernel.fs.readFile('/greeting', 'utf-8', function(err: any, contents: string): void {
			expect(err).to.be.undefined;
			expect(contents).to.equal('hi\n');
			done();
		});
	});
});
