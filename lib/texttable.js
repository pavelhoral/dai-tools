"use strict";
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');


class FileSearch extends EventEmitter {

    search(base, context) {
        fs.readdirSync(base).forEach(file => {
            const fullpath = path.join(base, file);
            const isdir = fs.statSync(fullpath).isDirectory();
            this.emit('file', fullpath, isdir, context);
        });
    }

}

/**
 * Search for text table files under the given language.
 */
function search(directory, lang) {
    const aggregate = [];
    // Translation file search
    const fileSearch = new FileSearch().
        on('file', (file, isdir, context) => {
            context = path.join(context, path.basename(file));
            if (isdir) {
                fileSearch.search(file, context);
            } else if (file.endsWith('.txt')){
                aggregate.push({ file: file, lang: lang, context: context });
            }
        });
    const langSearch = new FileSearch().
        on('file', (file, isdir) => {
            if (isdir && path.basename(file) === lang) {
                fileSearch.search(file, '');
            }
        });
    // Translation base search
    const baseSearch = new FileSearch().
        on('file', (file, isdir) => {
            if (isdir && path.basename(file) !== 'texttable') {
                baseSearch.search(file);
            } else if (isdir) {
                baseSearch.emit('base', file);
            }
        }).
        on('base', base => {
            langSearch.search(base);
        });

    baseSearch.search(directory);
    return aggregate;
}
module.exports.search = search;


/**
 * Parse specified text table file.
 */
function parse(file) {
    return fs.readFileSync(file, 'UTF-16LE').replace(/^\uFEFF/, '').split('\n').
        filter(line => !!line.length).map(line => {
            let split = line.indexOf('=');
            return [line.substring(0, split), line.substring(split + 1).trim()]
        });
}
module.exports.parse = parse;


/**
 * Write table entries in the specified file.
 */
function write(file, entries) {
    let data = '\uFEFF' + entries.map(entry => entry[0] + '=' + entry[1]).join('\r\n') + '\r\n';
    fs.writeFileSync(file, data, { encoding: 'UTF-16LE' });
}
module.exports.write = write;
