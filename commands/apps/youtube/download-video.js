#!/usr/bin/env node

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Download-youtube-video
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 🤖
// @raycast.packageName youtube

// Documentation:
// @raycast.description use youtube video on the clipboard to download the video
// @raycast.author Ayoub Gharbi
// @raycast.authorURL https://github.com/ayoub-g

const { exec } = require("child_process");
(async () => {
  try {
    const execPromise = promisifyExec(exec);
    const url = await execPromise("pbpaste");
    const isValid = verifyUrl(url);
    if (isValid) {
      // when piping the folowing three commands in one command, the command might fail
      const res1 = await execPromise(`youtube-dl -F ${url}`);
      const res2 = await execPromise(`echo '${res1}' | sed -E -e '/video only|audio only|youtube|format|info/d'`);
      let videoQuality = await execPromise(`echo '${res2}' | awk 'NR==1{print substr($0,1,3)}'|tr -d '\n'`);
      await execPromise(`youtube-dl -f ${videoQuality} ${url}`, { cwd: "/users/ayoubgharbi/Downloads/code-de-la-route" });
      console.log("download completed");
    } else {
      console.error("not a valid url");
    }
  } catch (error) {
    console.log("error");
    console.log(error);
  }
})();

function verifyUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

function promisifyExec(original) {
  if (typeof original !== "function") {
    throw "the argument must be a function";
  } else {
    function fn() {
      let promiseResolve;
      let promiseReject;
      let promise = new Promise(function (resolve, reject) {
        promiseResolve = resolve;
        promiseReject = reject;
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
