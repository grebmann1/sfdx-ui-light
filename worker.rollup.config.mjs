import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';

export default {
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
};