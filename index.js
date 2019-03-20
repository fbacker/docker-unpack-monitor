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
      // "We cant check folders, ignore for now, but deep scan it"
      return reject(null);
    } else {
      // check the file
      const fileObj = path.parse(name);
      if (config.ext.includes(fileObj.ext)) {
        const unpackedFileCheck = path.join(fileObj.dir, `.${fileObj.name}`);
        if (fs.existsSync(unpackedFileCheck)) {
          //file exists
          return reject("Already unpacked file " + name);
        } else {
          return resolve(name);
        }
      }
    }
    // "Not interested in file format, ignore"
    return reject(null);
  });

watch(config.path, { recursive: true }, (evt, file) => {
  watchFolderCheckValid(file, evt)
    .then(fileValidated => {
      que.push({ file: fileValidated, time: moment(), retry: 0 });
    })
    .catch(e => {
      // do nothing
      if (e) console.error(e);
    });
});

const checkFolder = path => {
  walk(path, (err, files) => {
    files.forEach(file => {
      watchFolderCheckValid(file, "existing")
        .then(fileValidated => {
          console.log("Found file to unpack, add to que", fileValidated);
          que.push({ file: fileValidated, time: moment(), retry: 0 });
        })
        .catch(e => {
          // do nothing
          if (e) console.error(e);
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
    console.log("Que: Want to unpack ", item.file);

    let command = `unrar x -o- "${item.file}" "${fileObj.dir}"`;
    shell.exec(command, function(code, stdout, stderr) {
      // console.log(stdout);
      const NoFilesToExtract = stdout.match(/no files to extract/gim); // already unpacked
      const CompletedExtract = stdout.match(/all ok/gim); // successfull unpacked

      // console.log("did match", { NoFilesToExtract, CompletedExtract });

      let didUnpack = false;
      if (NoFilesToExtract && NoFilesToExtract.length > 0) {
        didUnpack = true;
        console.log("Was already unpacked");
      } else if (CompletedExtract && CompletedExtract.length > 0) {
        didUnpack = true;
        console.log("Unpacked and ready to be used");
      } else {
        if (item.retry > 3) {
          console.error("We couldn't unpack, lets stop trying");
        } else {
          console.error(
            "We couldn't unpack, add to list with delay of 10min, retry count",
            item.retry
          );
          que.push({
            file: item.file,
            time: moment().add(10, "minutes"),
            retry: item.retry + 1
          });
        }
      }

      if (didUnpack) {
        const fileTmpCreate = path.join(fileObj.dir, `.${fileObj.name}`);
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
  }
}, 1000);
