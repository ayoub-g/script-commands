#!/usr/bin/env node

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Extract audio from youtube video
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 🤖
// @raycast.packageName youtube

// Documentation:
// @raycast.description Extract audio from youtube video
// @raycast.author Ayoub Gharbi
// @raycast.authorURL https://github/ayoub-g

const { exec, spawn } = require("child_process");
const fs = require("fs").promises;
const execPromise = promisifyExec(exec);
(async () => {
  const url = await execPromise("pbpaste");
  const isValid = verifyUrl(url);
  if (isValid) {
    const results = await runInParallel([
      execPromise(`youtube-dl --get-duration ${url}`),
      execPromise(`youtube-dl --youtube-skip-dash-manifest -g ${url}`),
    ]);
    // youtube-dl adds \n each output  we'll use it as a seperator
    const [duration, streamingLink] = results[0].split("\n");
    const [minutes, seconds] = duration.replace(/'\n'/, /''/).split(":");
    const videoDurationInSeconds = parseInt(minutes) * 60 + parseInt(seconds);
    download(streamingLink, videoDurationInSeconds);
  } else {
    console.error("not a valid url");
  }
})();

const combineFiles = async () => {
  try {
    await fs.unlink("./mylist.txt");
  } catch (error) {
  } finally {
    // put in the finally block because the file may not exist
    await execPromise("printf \"file '$PWD/%s'\n\" *.aac >> mylist.txt");
    const combine = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", "mylist.txt", "-c", "copy", "res.aac"]);
    combine.on("exit", () => {
      performance.measure("Start to Now");
      console.log("combine completed");
      process.exit(0);
    });
    combine.on("error", (err) => {
      console.log(err);
    });
  }
};
const download = (streamingLink, videoDuration) => {
  const part1 = Math.floor(videoDuration / 2);

  let sp1_exited = false;
  let sp2_exited = false;
  // youtube dl return two streams links separated by \n the second one is the audio stream
  const sp1 = spawn("ffmpeg", ["-y", "-acodec", "copy", "audio-1.aac", "-t", part1, "-i", streamingLink]);
  const sp2 = spawn("ffmpeg", [
    "-y",
    "-ss",
    part1 - 20,
    "-ss",
    part1,
    "-to",
    String(videoDuration),
    "-acodec",
    "copy",
    "audio-2.aac",
    "-i",
    streamingLink,
  ]);
  sp1.on("exit", () => {
    sp1_exited = true;
    if (sp2_exited) {
      // performance.measure("Start to Now");
      console.log("download files completed");
      process.exit(0);
    }
  });

  sp2.on("exit", () => {
    sp2_exited = true;
    if (sp1_exited) {
      // performance.measure("Start to Now");
      console.log("download files completed");
      process.exit(0);
    }
  });
};

function promisifyExec(original) {
  if (typeof original !== "function") {
    throw "parameter must be a function";
  } else {
    function fn() {
      let promiseReject;
      let promiseResolve;
      let promise = new Promise(function (resolve, reject) {
        promiseReject = reject;
        promiseResolve = resolve;
      });
      let args = [];

      for (let i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
      }
      function callback(err, res1, res2) {
        if (err) {
          promiseReject(err);
        } else {
          promiseResolve(res1, res2);
        }
      }
      args.push(callback);
      original.apply(this, args);
      return promise;
    }
    return fn;
  }
}

function runInParallel(promises) {
  let promiseResolve;
  let promiseReject;

  let promise = new Promise(function (resolve, reject) {
    promiseResolve = resolve;
    promiseReject = reject;
  });

  if (Array.isArray(promises)) {
    let done = 0;
    let results = [];

    for (let i = 0; i < promises.length; i++) {
      promises[i]
        .then((res) => results.push(res))
        .catch((err) => results.push(err))
        .finally(() => {
          done++;

          if (done >= promises.length) {
            promiseResolve(results);
          }
        });
    }
  } else {
    promiseReject("parameter must be an array of promises");
  }
  return promise;
}

function verifyUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
