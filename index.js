const icy = require('icy');
const { Writable } = require('stream');
const fs = require('fs');
const path = require('path');

// URL to a known ICY stream

// open the streams
class SongWriteStream {
    constructor(filename) {
        this.filename = filename;
    }

    createWriteStream() {
        fs.closeSync(fs.openSync(this.filename, 'w'));
        return fs.createWriteStream(this.filename);
    }

    renameWriteStream(newName) {
        fs.rename(this.filename, newName, err => {
            if (err) throw err;
        });

        this.filename = newName;
    }

    getFilesizeInMBytes() {
        return fs.statSync(this.filename).size / 1000000.0;
    }

    // deleteWriteStream() {
    //     fs.unlinkSync(this.filename);
    // }
}

class MyWritable extends Writable {
    constructor(options) {
        super(options);

        this.doRestartFile = false;
        this.stream = null;
        this.filename = options.filename;
        this.prevFilename = undefined;
        this.writeStream = undefined;
        this.isPaused = false;
        this.objSongs = undefined;
        this.songDetails = undefined;
    }

    _write(chunk, encoding, callback) {
        if (!this.stream) {
            // No stream, start a new one
            this.writeStream = new SongWriteStream(this.filename);
            this.stream = this.writeStream.createWriteStream();
        }

        if (this.doRestartFile) {
            // Swapping files, end current stream and return
            this.stream.end(chunk, encoding, callback);

            this.stream.on('finish', () => {
                if (!this.prevFilename.includes('undefined.mp3')) {
                    const newPath = path.join(
                        path.dirname(this.prevFilename),
                        'records',
                        path.basename(this.prevFilename)
                    );

                    fs.rename(this.prevFilename, newPath, err => {
                        if (err) throw err;
                    });

                    this.objSongs.writeSongLists(this.songDetails);
                }
            });

            this.stream = null;

            this.doRestartFile = false;
            return;
        }

        if (this.writeStream.getFilesizeInMBytes() > 25) {
            this.restartFile(this.filename);
        }

        // Otherwise write chunks to current stream
        this.stream.write(chunk, encoding, callback);
    }

    setObjSongs(objSongsClass, arrSongDetails) {
        this.objSongs = objSongsClass;
        this.songDetails = arrSongDetails;
    }

    restartFile(filename) {
        this.prevFilename = this.filename;
        this.filename = filename;
        this.doRestartFile = true;
    }

    renameFile(filename) {
        this.filename = filename;
        this.writeStream.renameWriteStream(this.filename);
    }

    closeStream() {
        this.isPaused = true;
        // this.writeStream.deleteWriteStream();
    }
}

class SongListWriter {
    constructor(strAllSongListBckp, strCurSongListFile) {
        this.filenameContents = null;
        this.strAllSongListBckp = strAllSongListBckp;
        this.strCurSongListFile = strCurSongListFile;
    }

    readCatalog() {
        return fs.readdirSync(this.strAllSongListBckp);
    }

    writeSongLists(contents) {
        fs.writeFile(`${this.strAllSongListBckp}/${contents.filename}`, '', err => {
            if (err) console.log(err);
        });

        this.filenameContents = JSON.parse(
            fs.readFileSync(this.strCurSongListFile, 'utf8', data => data)
        );
        this.filenameContents.songlist.push(contents);
        fs.writeFile(
            this.strCurSongListFile,
            JSON.stringify(this.filenameContents),
            'utf8',
            err => {
                if (err) console.log(err);
            }
        );
    }
}

class StationRecorder {
    constructor({ title, url }) {
        this.title = title;
        this.url = url;
        this.init();
    }

    init() {
        const songFolder = path.join(__dirname, this.title);
        const songBckpFolder = path.join(songFolder, '/bckp');
        const songRecordsFolder = path.join(songFolder, '/records');
        const strCurSongListFile = path.join(songRecordsFolder, 'song-list.json');

        function checkFolderStructure() {
            if (!fs.existsSync(songBckpFolder)) {
                fs.mkdirSync(songBckpFolder, { recursive: true });
            }

            if (!fs.existsSync(songRecordsFolder)) {
                fs.mkdirSync(songRecordsFolder, { recursive: true });
            }

            if (!fs.existsSync(strCurSongListFile)) {
                fs.writeFile(
                    strCurSongListFile,
                    JSON.stringify({
                        songlist: []
                    }),
                    err => {
                        if (err) console.log(err);
                    }
                );
            }
        }

        icy.get(this.url, res => {
            const undefinedFile = path.join(songFolder, 'undefined.mp3');
            const writable = new MyWritable({ filename: undefinedFile });

            res.pipe(
                writable,
                { end: false }
            );

            checkFolderStructure();

            console.log(res);

            res.on('metadata', metadata => {
                checkFolderStructure();

                const strSongName = String(icy.parse(metadata).StreamTitle).replace(
                    /\//gi,
                    ' (feat) '
                );

                writable.restartFile(undefinedFile);

                if (strSongName !== ' - ') {
                    console.log(strSongName);

                    const objSongs = new SongListWriter(songBckpFolder, strCurSongListFile);
                    const isInList = objSongs
                        .readCatalog()
                        .some(filename => filename === strSongName);

                    if (!isInList) {
                        writable.renameFile(path.join(songFolder, '/', `${strSongName}.mp3`));
                        let arrSongDetails = strSongName.split(' - ');
                        arrSongDetails = {
                            artist: arrSongDetails[0],
                            title: arrSongDetails[1],
                            filename: strSongName
                        };

                        writable.setObjSongs(objSongs, arrSongDetails);

                        console.log(strSongName, 'recording');
                    } else {
                        writable.closeStream();
                    }
                }
            });
        });
    }
}

const stations = {
    Innocence: new StationRecorder({
        title: 'Innocence',
        url: 'http://air2.radiorecord.ru:9003/ibiza_320'
    })
    // Tecktonik: new StationRecorder({
    //     title: 'Tecktonik',
    //     url: 'http://air2.radiorecord.ru:9003/tecktonik_320'
    // }),
    // Neurofunk: new StationRecorder({
    //     title: 'Neurofunk',
    //     url: 'http://air2.radiorecord.ru:9003/neurofunk_320'
    // })
};
