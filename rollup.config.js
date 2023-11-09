import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';


export default {
    input: 'client/main.js',
    output: {
        file: 'dist/main.js',
        format: 'esm',
    },
    plugins: [
        replace({
            'process.env.NODE_ENV': JSON.stringify('development'),
        }),
        lwc(),
        copy({
            targets: [
              { src: 'node_modules/@salesforce-ux/design-system/assets', dest: 'dist/client'}
            ],
            copyOnce: true
        }),
        copy({
            targets: [
              { src: 'client/index.html', dest: 'dist/client' },
              { src: 'client/assets', dest: 'dist/client' },
              { src: 'client/modules/util', dest: 'dist' },
              { src: 'electron', dest: 'dist' },
            ]
        })
    ],
};