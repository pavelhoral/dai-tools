#!/usr/bin/env node
const program = require('commander');

program.
    usage('[options] <dirs...>').
    description('Extract CSV translations.').
    option('-l, --langs [codes]', 'languages to extract', value => value.split(','), ['en', 'pl']).
    parse(process.argv);

if (program.args.length < 1) {
    program.help();
}

const path = require('path');
const fs = require('fs');
const CSV = require('csv');
const texttable = require('./lib/texttable');

const CONVERSION_BUFFER = Buffer.alloc(4);

/**
 * Parse translation string key.
 */
function parseKey(key) {
    var split = key.lastIndexOf('-');
    CONVERSION_BUFFER.writeUInt32BE(parseInt(key.substring(split + 1)));
    return {
        id: CONVERSION_BUFFER.toString('hex').toUpperCase(),
        tag: key.substring(0, split),
        key: key
    };
}

/**
 * Raw parsed strings.
 */
let strings = [];

program.langs.forEach(lang => {
    program.args.forEach(base => {
        texttable.search(base, lang).forEach(table => {
            let counter = {};
            texttable.parse(table.file).forEach((entry, line) => {
                counter[entry[0]] = (counter[entry[0]] || 0) + 1;
                strings.push(Object.assign({
                    value: entry[1],
                    lang: table.lang,
                    file: table.context,
                    index: counter[entry[0]],
                    line: line + 1
                }, parseKey(entry[0])));
            });
        });
    });
});


/**
 * Paired strings (multiple translations in one string).
 */
let paired = {};

strings.forEach(string => {
    let index = path.dirname(string.file) + ':' + string.key + ':' + string.index;
    let pairing = paired[index];
    if (!pairing) {
        pairing = paired[index] = string;
    }
    if (pairing[string.lang] && pairing[string.lang] !== string.value) {
        console.error(`WARN ${index} Different strings encountered.`);
    } else {
        pairing[string.lang] = string.value;
    }
});


/**
 * Squashed strings (single string for a single translation).
 */
let squashed = {};

Object.keys(paired).map(key => paired[key]).forEach(string => {
    let index = string.id + '-' + string.tag + ': ' + string.value;
    let prev = squashed[index];
    if (!prev) {
        squashed[index] = string;
    } else if (prev.index !== string.index) {
        console.error(`WARN ${string.file}:${string.line} Different index encountered`);
    }
});


/**
 * Remove non-translatable strings.
 */
Object.keys(squashed).forEach(key => {
    let string = squashed[key];
    let invalid = program.langs.every(lang => {
        return !string[lang] ||
                /^(\{string\}[0-9]+\{\/string\} ?)+$/.test(string[lang]) ||
                /^\{[^\}]+\}$/.test(string[lang]);
    });
    if (invalid) {
        delete squashed[key];
    }
});


/**
 * String occurrence counter.
 */
let counter = {};

Object.keys(squashed).map(key => squashed[key]).forEach(string => {
    program.langs.filter(lang => !!string[lang]).forEach(lang => {
      let index = lang + ':' + string[lang];
      counter[index] = (counter[index] || 0) + 1;
  });
});
Object.keys(squashed).map(key => squashed[key]).forEach(string => {
    program.langs.forEach(lang => {
      var index = lang + ':' + string[lang];
      string['#' + lang] = counter[index] || '';
  });
});


let columns = ['id', 'tag', 'key'];
program.langs.forEach(lang => {
    columns.push(lang);
    columns.push('#' + lang);
});

var writer = CSV.stringify({ header: true, columns: columns, delimiter: ';'});
writer.pipe(process.stdout);
Object.keys(squashed).sort().map(key => squashed[key]).forEach(string => {
    writer.write(string);
});
writer.end();
