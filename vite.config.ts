import { dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __dirname = dirname(fileURLToPath(import.meta.url))
// https://vite.dev/config/
export default defineConfig({
    plugins: [dts({ tsconfigPath: './tsconfig.app.json' })],
    esbuild: {
        charset: 'utf8',
    },
    build: {
        minify: false,
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'src/index'),
            name: 'data-source',
            // the proper extensions will be added
            fileName: 'data-source',
            formats: ["es", "umd"]
        },
        rollupOptions: {
            // external: ['mobx', 'ajv', 'axios'],
            external: (id) => {
                return !id.startsWith(".") && !isAbsolute(id);
            },
        },
    },
})
