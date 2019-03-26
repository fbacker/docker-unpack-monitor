const path = require("path");
const fs = require("fs");
const watch = require("node-watch");
const shell = require("shelljs");
const moment = require("moment");

const startupPath =
  process.env.ENVIRONMENT === "production"
    ? "/watch"
    : "/Users/backer/Work/docker-unpack-monitor/tmp-test";
const config = {
  path: startupPath,
  ext: [".rar"],
  delayUnpackSeconds: 5
};
let que = [];
let isRunning = false;

const shortname = file => {
  const fileObj = path.parse(file);
  const fileOutputDir =
    "../.." + fileObj.dir.substr(fileObj.dir.lastIndexOf("/"));
  const out = path.join(fileOutputDir, fileObj.base);
  return out;
};
/**
 *
 * @param {string} dir Path to recursivly look at
 * @param {Function} done Callback when done
 */
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

/**
 *
 * @param {string} file path to file that will be checked
 * @param {string} event watch event that triggered
 */
const watchFolderCheckValid = (file, event) =>
  new Promise((resolve, reject) => {
    if (event === "remove") {
      //console.log(`File removed '${file}'`);
      return reject();
    }

    // maybe its a folder
    if (fs.lstatSync(file).isDirectory()) {
      // We cant check folders, but deep scan it
      console.log(`Is a folder, send to deep scan '${shortname(file)}'`);
      checkFolder(file);
      return reject();
    } else {
      // check the file
      const fileObj = path.parse(file);
      if (config.ext.includes(fileObj.ext.toLowerCase())) {
        const unpackedFileCheck = path.join(fileObj.dir, `.${fileObj.name}`);
        if (fs.existsSync(unpackedFileCheck)) {
          //file exists
          console.log(
            `Already unpacked file '${shortname(file)}' remove '.${
              fileObj.name
            }' to unpack again.`
          );
          return reject();
        } else {
          return resolve(file);
        }
      }
    }
    // Not interested in file format
    return reject();
  });

/**
 *
 * @param {string} file file to unpack
 */
const addFileToQue = file => {
  // do not put duplicates in que
  for (let i = 0; i < que.length; i++) {
    if (que[i].file === file) {
      //console.log(`Path is already in que '${file}'`)
      return;
    }
  }
  console.log(`Add unpack file to que ${file}`);
  que.push({ file, time: moment(), retry: 0 });
};
/**
 * watch for file changes on disk
 */
watch(config.path, { recursive: true }, (evt, file) => {
  watchFolderCheckValid(file, evt)
    .then(fileValidated => {
      addFileToQue(fileValidated);
    })
    .catch(() => {});
});

/**
 *
 * @param {string} file check all files in folder
 */
const checkFolder = file => {
  walk(file, (err, files) => {
    files.forEach(file => {
      watchFolderCheckValid(file, "existing")
        .then(fileValidated => {
          addFileToQue(fileValidated);
        })
        .catch(() => {});
    });
  });
};

/**
 * Application loop
 */
setInterval(() => {
  if (isRunning) return;
  if (que.length === 0) return;

  const item = que[0];
  const duration = moment.duration(moment().diff(item.time));
  if (duration.asSeconds() > config.delayUnpackSeconds) {
    isRunning = true;
    que.shift();
    const fileObj = path.parse(item.file);
    console.log(`Que: Trying to unpack ${shortname(item.file)}`);

    let command = `unrar x -o- "${item.file}" "${fileObj.dir}"`;
    shell.exec(command, { silent: true }, function(code, stdout, stderr) {
      // console.log(stdout);
      const NoFilesToExtract = stdout.match(/no files to extract/gim); // already unpacked
      const CompletedExtract = stdout.match(/all ok/gim); // successfull unpacked

      // console.log("did match", { NoFilesToExtract, CompletedExtract });

      let didUnpack = false;
      if (NoFilesToExtract && NoFilesToExtract.length > 0) {
        didUnpack = true;
        console.log(`Que: Was already unpacked '${shortname(item.file)}'`);
      } else if (CompletedExtract && CompletedExtract.length > 0) {
        didUnpack = true;
        console.log(
          `Que: Unpacked and ready to be used '${shortname(item.file)}'`
        );
      } else {
        if (item.retry > 3) {
          console.error(
            `We couldn't unpack, lets stop trying '${shortname(item.file)}'`
          );
        } else {
          console.error(
            `We couldn't unpack, add to list with delay of 10min, retry count ${
              item.retry
            } on file '${shortname(item.file)}'`
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

// Start to check all files
checkFolder(config.path);
