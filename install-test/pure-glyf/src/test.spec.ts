import { describe, it, expect } from 'vitest';
// We can't easily import the plugin runtime directly if it relies on the transformation unless we run via the plugin.
// But we can check if the package imports correctly.

import { mount } from 'pure-glyf';

describe('pure-glyf integration', () => {
    it('should be importable', () => {
        expect(mount).toBeDefined();
    });
});

