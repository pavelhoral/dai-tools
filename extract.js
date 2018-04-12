#!/usr/bin/env node
"use strict";
var path = require('path');
var fs = require('fs');
var csv = require('csv')

if (process.argv.length < 3) {
    console.error(`Usage: ${path.basename(process.argv[1])} <directory...>`);
    process.exit(1);
}

var languages = [];
var aggregate = {};

function processDir(directory, language) {
    fs.readdirSync(directory).map(file => path.join(directory, file)).forEach(file => {
        var stat = fs.statSync(file);
        if (stat.isDirectory()) {
            processDir(file, path.basename(directory) === 'texttable' ? parseLanguage(file) : language);
        } else if (language && file.endsWith('.txt')) {
            processFile(file, path.basename(file), language);
        }
    });
}

function parseLanguage(directory) {
    var language = path.basename(directory);
    return /[a-z]{2}/.test(language) ? language : null;
}

function processFile(file, name, language) {
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
            processLine(parseKey(line.substring(0, split)), value, name.replace(/\.?bin_VB.txt/, ''), language);
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
    var index = key.id + '-' + key.tag;
    var string = aggregate[index];
    if (!string) {
        string = Object.assign({
            context: [context]
        }, key);
        aggregate[index] = string;
    }
    if (!string[language]) {
        string[language] = value;
    }
    if (string.context.indexOf(context) < 0) {
        string.context.push(context);
    }
    if (string[language] !== value) {
        console.error(`WARN: ${key.id} ${key.key} Different strings [${string.context.join(',')}].`);
    }
}

for (let i = 2; i < process.argv.length; i += 1) {
    processDir(process.argv[i]);
}

var writer = csv.stringify({ header: true, columns: ['id', 'tag', 'key'].concat(languages), delimiter: ';'});
writer.pipe(process.stdout);
Object.keys(aggregate).sort().map(key => aggregate[key]).forEach(string => {
    writer.write(string);
});
writer.end();
