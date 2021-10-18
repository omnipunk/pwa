// -----------------------------------------------------------------------------
// Init service worker
// -----------------------------------------------------------------------------
var goappOnUpdate = function () { };

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/app-worker.js")
    .then(reg => {
      console.log("registering app service worker");

      reg.onupdatefound = function () {
        const installingWorker = reg.installing;
        installingWorker.onstatechange = function () {
          if (installingWorker.state == "installed") {
            if (navigator.serviceWorker.controller) {
              goappOnUpdate();
            }
          }
        };
      }
    })
    .catch(err => {
      console.error("offline service worker registration failed", err);
    });
}

// -----------------------------------------------------------------------------
// Env
// -----------------------------------------------------------------------------
const goappEnv = {"GOAPP_INTERNAL_URLS":"null","GOAPP_ROOT_PREFIX":"","GOAPP_STATIC_RESOURCES_URL":"","GOAPP_VERSION":"10f9f1f1d3d99e46889e154f53379806b8996dce"};

function goappGetenv(k) {
  return goappEnv[k];
}

// -----------------------------------------------------------------------------
// App install
// -----------------------------------------------------------------------------
let deferredPrompt = null;
var goappOnAppInstallChange = function () { };

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  goappOnAppInstallChange();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  goappOnAppInstallChange();
});

function goappIsAppInstallable() {
  return !goappIsAppInstalled() && deferredPrompt != null;
}

function goappIsAppInstalled() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isStandalone || navigator.standalone;
}

async function goappShowInstallPrompt() {
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
}

// -----------------------------------------------------------------------------
// Keep body clean
// -----------------------------------------------------------------------------
function goappKeepBodyClean() {
  const body = document.body;
  const bodyChildrenCount = body.children.length;

  const mutationObserver = new MutationObserver(function (mutationList) {
    mutationList.forEach((mutation) => {
      switch (mutation.type) {
        case 'childList':
          while (body.children.length > bodyChildrenCount) {
            body.removeChild(body.lastChild);
          }
          break;
      }
    });
  });

  mutationObserver.observe(document.body, {
    childList: true,
  });

  return () => mutationObserver.disconnect();
}

// -----------------------------------------------------------------------------
// Init Web Assembly
// -----------------------------------------------------------------------------
async function initWebAssembly() {
  if (!/bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent)) {
    const go = new Go();

    const loaderLabel = document.getElementById("app-wasm-loader-label");

    let response = await fetch("/web/app.wasm");
    const reader = response.body.getReader();
    const contentLength = response.headers.get('Content-Length');
    let receivedLength = 0;

    let wasmFile = new Uint8Array(contentLength);
    let idx = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (value.length !== 0) {
        wasmFile.set(value, idx);
        idx += value.length;
        loaderLabel.innerText = `${(idx / contentLength * 100).toFixed(2)}%`
      }

      if (done) {
        break;
      }
    }

    WebAssembly.instantiate(wasmFile.buffer, go.importObject)
      .then(result => {
        const loaderIcon = document.getElementById("app-wasm-loader-icon");
        loaderIcon.className = "goapp-logo";

        go.run(result.instance);
      })
      .catch(err => {
        const loaderIcon = document.getElementById("app-wasm-loader-icon");
        loaderIcon.className = "goapp-logo";

        const loaderLabel = document.getElementById("app-wasm-loader-label");
        loaderLabel.innerText = err;

        console.error("loading wasm failed: " + err);
      });
  } else {
    document.getElementById('app-wasm-loader').style.display = "none";
  }
}

initWebAssembly();
