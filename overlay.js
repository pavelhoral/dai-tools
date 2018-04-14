#!/usr/bin/env node
const program = require('commander');

program.
    usage('[options] <source...>').
    description('Apply CSV translations.').
    option('-t, --target <directory>', 'target directory').
    option('-l, --lang <lang>', 'target language', 'en').
    option('-e, --empty', 'allow empty strings').
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
    let missed = 0;
    let entries = [];
    texttable.parse(table.file).forEach((entry, line) => {
        let string = strings[entry[0] + ':' + entry[1]];
        if (string && (program.empty || string['cs'])) {
            entry[1] = string['cs'];
            changed += 1;
        } else if (entry[1] &&
                !/^(\{string\}[0-9]+\{\/string\} ?)+$/.test(entry[1])  &&
                !/^\{[^\}]+\}$/.test(entry[1])) {
            missed += 1;
        }
        entries.push(entry);
    });
    if (changed) {
        console.log(`INFO Updating ${changed} entries in ${table.file}.`);
        texttable.write(table.file, entries);
    }
    if (missed) {
        console.log(`INFO Missed ${missed} entries in ${table.file}.`);
    }
});
