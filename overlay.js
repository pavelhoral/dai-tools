#!/usr/bin/env node
const program = require('commander');

program.
    usage('[options] <source...>').
    description('Apply CSV translations.').
    option('-t, --target <directory>', 'target directory').
    option('-l --lang <lang>', 'target language', 'en').
    parse(process.argv);

if (!program.target || program.args.length < 1) {
    program.help();
}

const path = require('path');
const fs = require('fs');
const parseCsv = require('csv-parse/lib/sync');
const texttable = require('./lib/texttable');

/**
 * Source string dictionary.
 */
let strings = {};

program.args.forEach(file => {
    parseCsv(fs.readFileSync(file), { delimiter: ';', columns: true }).forEach(string => {
        strings[string.key + ':' + string[program.lang]] = string;
    });
});


texttable.search(program.target, program.lang).forEach(table => {
    let changed = 0;
    let entries = [];
    texttable.parse(table.file).forEach((entry, line) => {
        let string = strings[entry[0] + ':' + entry[1]];
        if (string) {
            entry[1] = string['cs'];
            changed += 1;
        }
        entries.push(entry);
    });
    if (changed) {
        console.log(`DEBUG Updating ${changed} entries in ${table.file}.`);
        texttable.write(table.file, entries);
    }
});
