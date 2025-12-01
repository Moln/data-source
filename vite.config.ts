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
        sourcemap: true,
        lib: {
            entry: {
                'data-source': resolve(__dirname, 'src/index'),
                ajv: resolve(__dirname, 'src/schema/AjvSchema'),
            },
            // name: 'ds',
            // the proper extensions will be added
            // fileName: 'data-source',
            // formats: ["es", "umd"]
        },
        rollupOptions: {
            // external: ['mobx', 'ajv', 'axios'],
            external: (id) => {
                return !id.startsWith(".") && !isAbsolute(id);
            },
            output: {
                exports: "named"
            }
        },
    },
})
