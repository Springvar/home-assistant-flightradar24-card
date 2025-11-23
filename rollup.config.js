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
            format: {
                comments: false,
                beautify: true
            },
            compress: false,
            mangle: false
        })
    ]
};
