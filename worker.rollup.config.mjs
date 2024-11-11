import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import nodePolyfills from 'rollup-plugin-polyfill-node';



/*export default {
  input: 'src/workers/openaiWorker/worker.js', // your source file
  output: {
	file: 'chrome_ext/workers/openaiWorker/worker.js',
	format: 'iife', // immediately-invoked function expression — suitable for <script> tags
	sourcemap: true // optional but helpful for debugging
  },
  plugins: [
	resolve(), // tells Rollup how to find node modules in node_modules
	commonjs(), // converts CommonJS modules to ES6, so they can be included in a Rollup bundle
	babel({
	  babelHelpers: 'bundled',
	  presets: ['@babel/preset-env']
	})
  ]
};*/

export default (args) => {
	return [
		/*{
			input: 'src/workers/metadata.worker.js', // your source file
			output: {
				file: 'src/client/assets/libs/workers/metadata.worker.js',
				format: 'iife', // immediately-invoked function expression — suitable for <script> tags
				sourcemap: true // optional but helpful for debugging
			},
			plugins: [
				json(),
				resolve(), // tells Rollup how to find node modules in node_modules
				commonjs(), // converts CommonJS modules to ES6, so they can be included in a Rollup bundle
				babel({
					babelHelpers: 'bundled',
					presets: ['@babel/preset-env']
				})
			]
		},*/
		{
			input: 'src/workers/accessAnalyzer.worker.js', // your source file
			output: {
				file: 'src/client/assets/libs/workers/accessAnalyzer.worker.js',
				format: 'iife', // immediately-invoked function expression — suitable for <script> tags
				sourcemap: true // optional but helpful for debugging
			},
			plugins: [
				json(),
				resolve(), // tells Rollup how to find node modules in node_modules
				alias({
					entries: [
						{ find: 'imported/jsforce', replacement: path.resolve(__dirname, "src/client/assets/libs/jsforce/jsforce.js") },
						{ find: 'imported/sf', replacement: path.resolve(__dirname, "src/client/modules/shared/sf/sf.js") }
					]
				}),
				commonjs(), // converts CommonJS modules to ES6, so they can be included in a Rollup bundle
				nodePolyfills(),
				babel({
					babelHelpers: 'bundled',
					presets: ['@babel/preset-env']
				})
			]
		}
	]
};