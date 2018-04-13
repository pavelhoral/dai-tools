#!/usr/bin/env node
"use strict";
var path = require('path');
var fs = require('fs');
var CSV = require('csv')

if (process.argv.length < 3) {
    console.error(`Usage: ${path.basename(process.argv[1])} <directory...>`);
    process.exit(1);
}

var languages = [];
var aggregate = {};

function searchDir(directory) {
    fs.readdirSync(directory).map(file => path.join(directory, file)).forEach(file => {
        if (!fs.statSync(file).isDirectory()) {
            return;
        }
        var language = path.basename(directory) === 'texttable' ? parseLanguage(file) : null;
        if (language) {
            processDir(file, '', language);
        } else {
            searchDir(file);
        }
    });
}

function parseLanguage(directory) {
    var language = path.basename(directory);
    return /[a-z]{2}/.test(language) ? language : null;
}

function processDir(base, rel, language) {
    fs.readdirSync(path.join(base, rel)).map(file => path.join(base, rel, file)).forEach(file => {
        if (fs.statSync(file).isDirectory()) {
            processDir(base, path.join(rel, path.basename(file)), language);
        } else if (file.endsWith('.txt')) {
            processFile(file, rel, language);
        }
    });
}

function processFile(file, context, language) {
    if (languages.indexOf(language) < 0) {
        languages.push(language);
    }
    var content = fs.readFileSync(file, 'UTF-16LE').replace(/^\uFEFF/, '');
    content.split('\n').forEach(line => {
        var split = line.indexOf('=');
        if (split < 0) {
            return;
        }
        var value = line.substring(split + 1).trim();
        if (value && validateString(value)) {
            processLine(parseKey(line.substring(0, split)), value, context, language);
        }
    });
}

function validateString(string) {
    return !!string && !/^(\{string\}[0-9]+\{\/string\} ?)+$/.test(string) && !/^\{[^\}]+\}$/.test(string);
}

var buffer = Buffer.alloc(4);

function parseKey(key) {
    var split = key.lastIndexOf('-');
    buffer.writeUInt32BE(parseInt(key.substring(split + 1)));
    return {
        id: buffer.toString('hex').toUpperCase(),
        tag: key.substring(0, split),
        key: key
    };
}

function processLine(key, value, context, language) {
    var index = context + ':' + key.key;
    var string = aggregate[index];
    if (!string) {
        string = Object.assign({
            context: context
        }, key);
        aggregate[index] = string;
    }
    if (!string[language]) {
        string[language] = value;
    }
    if (string[language] !== value) {
        console.error(`WARN ${key.id} ${key.key} Different strings [${string.context.join(',')}].`);
    }
}

for (let i = 2; i < process.argv.length; i += 1) {
    searchDir(process.argv[i]);
}

var squashed = {};
Object.keys(aggregate).map(key => aggregate[key]).forEach(string => {
    var index = string.id + '-' + string.tag + ': ' + (string.en || string[languages[0]]);
    if (!squashed[index]) {
        squashed[index] = string;
    }
});

var counter = {};
Object.keys(squashed).map(key => squashed[key]).forEach(string => {
    languages.filter(language => !!string[language]).forEach(language => {
        var index = language + '\n' + string[language];
        counter[index] = (counter[index] || 0) + 1;
    });
});
Object.keys(squashed).map(key => squashed[key]).forEach(string => {
    languages.forEach(language => {
        var index = language + '\n' + string[language];
        string['#' + language] = counter[index] || '';
    });
});

var columns = ['id', 'tag', 'key'];
languages.forEach(language => {
    columns.push(language);
    columns.push('#' + language);
});
var writer = CSV.stringify({ header: true, columns: columns, delimiter: ';'});
writer.pipe(process.stdout);
Object.keys(squashed).sort().map(key => squashed[key]).forEach(string => {
    writer.write(string);
});
writer.end();
