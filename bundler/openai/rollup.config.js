import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
//import { terser } from '@rollup/plugin-terser';

export default {
  input: 'index.js',
  output: {
    file: 'bundle.min.js',
    format: 'umd',
    name: 'OpenAIAgentsBundle',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),
    //terser(),
  ],
  external: [],
}; 