// scripts/generate_keys.js
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const jsonc = require('jsonc-parser');

const LOCALIZATION_DIR = path.join(__dirname, '../src/localization');
const OUTPUT_DIR = path.join(__dirname, '../');
const SUPPORTED_LANGUAGES = fs.readdirSync(LOCALIZATION_DIR).filter(dir => fs.statSync(path.join(LOCALIZATION_DIR, dir)).isDirectory());

/**
 * Recursively flatten JSON to dot notation keys.
 * @param {object} obj
 * @param {string} prefix
 * @param {object} result
 */
function flatten(obj, prefix = '', result = {}) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            const newPrefix = prefix ? `${prefix}.${key}` : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                flatten(value, newPrefix, result);
            } else {
                result[newPrefix] = value;
            }
        }
    }
    return result;
}

/**
 * Main logic for one language.
 * @param {string} lang
 */
async function processLanguage(lang) {
    const baseDir = path.join(LOCALIZATION_DIR, lang);
    const files = await glob(`${baseDir}/**/*.jsonc`);

    let allEntries = {};

    for (const file of files) {
        // Determine section (commands/events/services/system)
        const relative = path.relative(baseDir, file);
        const parts = relative.split(path.sep);
        const section = parts[0];

        // Remove $schema from root
        const parsed = jsonc.parse(fs.readFileSync(file, 'utf-8'));
        if (parsed["$schema"]) {
            delete parsed["$schema"];
        }

        const flattened = flatten(parsed, section);
        allEntries = { ...allEntries, ...flattened };
    }

    // Write all to <lang>.txt
    const lines = Object.entries(allEntries).map(
        ([k, v]) => `${k} = "${String(v).replaceAll(/"/g, '\\"').replaceAll(/\n/g, '\\n')}"`
    );
    fs.writeFileSync(path.join(OUTPUT_DIR, `${lang}.txt`), lines.sort((a, b) => a.localeCompare(b)).join('\n'), 'utf-8');
    console.log(`Generated ${lang}.txt (${lines.length} entries)`);
}

(async function main() {
    for (const lang of SUPPORTED_LANGUAGES) {
        await processLanguage(lang);
    }
})();