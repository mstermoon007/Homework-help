/**
 * version.js — Unified version system for Homework Help
 *
 * All version constants are defined in one place so that:
 * - HTML templates, JS modules, and the Service Worker all read from the same source
 * - Stale JS / CSS loading is prevented by a single source-of-truth version injection
 * - CACHE_VERSION changes trigger Service Worker activation and cache cleanup
 * - BUILD_DATE provides reproducible builds and deployment audit trails
 */

const APP_VERSION = '3.1.1';
const CACHE_VERSION = 'homework-help-' + APP_VERSION;
const BUILD_DATE = new Date().toISOString();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APP_VERSION, CACHE_VERSION, BUILD_DATE };
}