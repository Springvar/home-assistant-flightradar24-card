import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
    input: 'flightradar24-card.js',
    output: {
        file: 'dist/home-assistant-flightradar24-card.js',
        format: 'es',
        sourcemap: false
    },
    plugins: [
        resolve(),
        commonjs(),
        terser({
            ecma: 2020,
            module: true,
            toplevel: true,
            format: {
                comments: false
            },
            compress: {
                passes: 3,
                drop_debugger: true,
                pure_getters: true
            },
            mangle: {
                toplevel: true
            }
        })
    ]
};
