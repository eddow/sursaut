import { defineConfig } from 'vite';
import { pureGlyfPlugin } from 'pure-glyf/plugin';


export default defineConfig({
    esbuild: {
        keepNames: true
    },
    plugins: [
        //pureGlyfPlugin({ icons: {} })
    ],

    build: {
        minify: false, // Easier to inspect
        rollupOptions: {
            input: 'src/consumer.ts'
        }
    }
});
