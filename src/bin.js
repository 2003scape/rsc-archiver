#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const pkg = require('../package');
const prettyBytes = require('pretty-bytes');
const yargs = require('yargs');
const { JagArchive, hashFilename } = require('./');

yargs
    .scriptName(pkg.name)
    .version(pkg.version)
    .command(
        ['x <archive> <file> [<out>]', 'extract'],
        'extract a file from an archive',
        yargs => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.positional('file', {
                description: 'the filename or hash within the archive',
                type: 'string'
            });

            yargs.positional('out', {
                description: 'the filename to write to',
                type: 'string',
                optional: true
            });
        },
        async argv => {
            const archive = new JagArchive();

            try {
                archive.readArchive(await fs.readFile(argv.archive));

                const file = archive.entries.get(+argv.file) ||
                    archive.entries.get(hashFilename(argv.file));

                if (!file) {
                    process.errorCode = 1;
                    console.error(`file/hash "${argv.file}" not found in "` +
                        `${argv.archive}"`);
                    return;
                }

                argv.out = argv.out || argv.file;

                await fs.writeFile(path.join('.', argv.out), file);
            } catch (e) {
                process.errorCode = 1;
                console.error(e);
            }
        })
    .command(
        ['a <archive> <file> [-g]', 'add'],
        'add a file to an archive',
        yargs => {
            yargs.option('g', {
                alias: 'group',
                description: 'compress files in one round instead of ' +
                    'individually',
                type: 'boolean',
                default: false
            });

            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.positional('file', {
                description: 'the file you would like to add',
                type: 'string'
            });
        },
        async argv => {
            const archive = new JagArchive();

            try {
                archive.readArchive(await fs.readFile(argv.archive));
            } catch (e) {
                // file doesn't exist, but writeFile will create it
            }

            try {
                const filename = path.basename(argv.file);
                archive.putEntry(filename, await fs.readFile(argv.file));
                await fs.writeFile(argv.archive, archive.toArchive(!argv.g));
            } catch (e) {
                process.exitCode = 1;
                console.error(e);
            }
        })
    .command(
        ['d <archive> <file>', 'delete'],
        'remove a file from an archive',
        yargs => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.positional('file', {
                description: 'the filename or hash you would like to remove',
                type: 'string'
            });
        },
        async argv => {
            const archive = new JagArchive();

            try {
                archive.readArchive(await fs.readFile(argv.archive));

                if (!archive.entries.delete(+argv.file) ||
                    !archive.entries.delete(hashFilename(argv.file))) {
                    console.log(`"${argv.file}" not found in "` +
                        `${argv.archive}"`);
                    return;
                }

                await fs.writeFile(argv.archive, archive.toArchive());
            } catch (e) {
                process.exitCode = 1;
                console.error(e);
            }
        })
    .command(
        ['l <archive>', 'list'],
        'list hashes and file sizes in an archive',
        yargs => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });
        },
        async argv => {
            const archive = new JagArchive();

            try {
                archive.readArchive(await fs.readFile(argv.archive));
            } catch (e) {
                process.exitCode = 1;
                console.error(e);
                return;
            }

            console.log('hash\t\tsize');

            for (const [hash, entry] of archive.entries) {
                console.log(`${hash}\t${entry.length} (` +
                    `${prettyBytes(entry.length)})`);
            }
        })
    .demandCommand()
    .argv;
