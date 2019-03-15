const path = require("path");
const fs = require("fs");
const watch = require("node-watch");
const shell = require("shelljs");
const moment = require("moment");

const config = {
  // path: "/Users/backer/Work/docker-unpack-monitor/tmp-test",
  path: "/watch",
  ext: [".rar"],
  delayUnpackSeconds: 5
};
let que = [];
let isRunning = false;

const walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var i = 0;
    (function next() {
      var file = list[i++];
      if (!file) return done(null, results);
      file = dir + "/" + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          results.push(file);
          next();
        }
      });
    })();
  });
};

const watchFolderCheckValid = (name, event) =>
  new Promise((resolve, reject) => {
    if (event === "remove") return reject("File removed, ignore");

    // maybe its a folder
    if (fs.lstatSync(name).isDirectory()) {
      checkFolder(name);
      return reject("We cant check folders, ignore for now, but deep scan it");
    } else {
      // check the file
      const fileObj = path.parse(name);
      if (config.ext.includes(fileObj.ext)) {
        const unpackedFileCheck = path.join(fileObj.dir, `.${fileObj.name}`);
        if (fs.existsSync(unpackedFileCheck)) {
          //file exists
          return reject("Already unpacked, ignore");
        } else {
          return resolve(name);
        }
      }
    }

    return reject("Not interested in file format, ignore");
  });

watch(config.path, { recursive: true }, (evt, file) => {
  console.log("file changed", file, evt);
  watchFolderCheckValid(file, evt)
    .then(fileValidated => {
      que.push({ file: fileValidated, time: moment() });
    })
    .catch(e => {
      // do nothing
      console.error(e);
    });
});

const checkFolder = path => {
  walk(path, (err, files) => {
    files.forEach(file => {
      watchFolderCheckValid(file, "existing")
        .then(fileValidated => {
          que.push({ file: fileValidated, time: moment() });
        })
        .catch(e => {
          // do nothing
          console.error(e);
        });
    });
  });
};
checkFolder(config.path);

setInterval(() => {
  if (isRunning) return;
  if (que.length === 0) return;

  const item = que[0];
  const duration = moment.duration(moment().diff(item.time));
  if (duration.asSeconds() > config.delayUnpackSeconds) {
    isRunning = true;
    que.shift();
    const fileObj = path.parse(item.file);
    console.log("want to unpack ", { item, duration });

    fs.readdir(fileObj.dir, (err1, files) => {
      let numOfFiles1 = files.length;
      let command = `unrar x -o- "${item.file}" "${fileObj.dir}"`;
      shell.exec(command, function(code, stdout, stderr) {
        console.log("unpacked"); //, { code, stdout, stderr });
        fs.readdir(fileObj.dir, (err1, files2) => {
          let numOfFiles2 = files2.length;
          const didUnpack = numOfFiles1 !== numOfFiles2;
          console.log("numOfFiles2", { numOfFiles1, numOfFiles2, didUnpack });
          if (didUnpack) {
            const fileTmpCreate = path.join(fileObj.dir, `.${fileObj.name}`);
            console.log("unpack this");
            fs.open(fileTmpCreate, "w", (err, fd) => {
              if (err) throw err;
              fs.close(fd, err => {
                if (err) throw err;
                isRunning = false;
              });
            });
          } else {
            isRunning = false;
          }
        });
      });
    });
  }
}, 1000);
