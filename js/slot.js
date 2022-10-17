var progressCount = 0; // current progress count
var progressTotalCount = 0; // total count
function updateProgress(inc) {
  progressCount += inc || 1;
  if (progressCount >= progressTotalCount) {
    // done, complete progress bar and hide loading screen
    $("#progress").css("width", "100%");
    $("#loading").slideUp(600);
  } else {
    // Update progress bar
    $("#progress").css(
      "width",
      parseInt((100 * progressCount) / progressTotalCount) + "%"
    );
  }
}

// Generic preloader handler, it calls preloadFunction for each item and
// passes function to it that it must call when done.
function preloader(items, preloadFunction, callback) {
  var itemc = items.length;
  var loadc = 0;

  // called by preloadFunction to notify result
  function _check(err, id) {
    updateProgress(1);
    if (err) {
      alert("Failed to load " + id + ": " + err);
    }
    loadc++;
    if (itemc == loadc) callback();
  }

  progressTotalCount += items.length;

  // queue each item for fetching
  items.forEach(function (item) {
    preloadFunction(item, _check);
  });
}

// Images must be preloaded before they are used to draw into canvas
function preloadImages(images, callback) {
  preloader(images, _preload, callback);

  function _preload(asset, doneCallback) {
    asset.img = new Image();
    asset.img.src = "img/" + asset.id + ".png";

    asset.img.addEventListener(
      "load",
      function () {
        doneCallback();
      },
      false
    );

    asset.img.addEventListener(
      "error",
      function (err) {
        doneCallback(err, asset.id);
      },
      false
    );
  }
}

function _initWebAudio(AudioContext, format, audios, callback) {
  // See more details in http://www.html5rocks.com/en/tutorials/webaudio/intro/

  var context = new AudioContext();

  preloader(audios, _preload, callback);

  function _preload(asset, doneCallback) {
    var request = new XMLHttpRequest();
    request.open("GET", "audio/" + asset.id + "." + format, true);
    request.responseType = "arraybuffer";

    request.onload = function () {
      context.decodeAudioData(
        request.response,
        function (buffer) {
          asset.play = function () {
            var source = context.createBufferSource(); // creates a sound source
            source.buffer = buffer; // tell the source which sound to play
            source.connect(context.destination); // connect the source to the context's destination (the speakers)

            // play the source now
            // support both webkitAudioContext or standard AudioContext
            source.noteOn ? source.noteOn(0) : source.start(0);
          };
          // default volume
          // support both webkitAudioContext or standard AudioContext
          asset.gain = context.createGain
            ? context.createGain()
            : context.createGainNode();
          asset.gain.connect(context.destination);
          asset.gain.gain.value = 0.5;

          doneCallback();
        },
        function (err) {
          asset.play = function () {};
          doneCallback(err, asset.id);
        }
      );
    };
    request.onerror = function (err) {
      console.log(err);
      asset.play = function () {};
      doneCallback(err, asset.id);
    };
    // kick off load
    request.send();
  }
}

function _initHTML5Audio(format, audios, callback) {
  preloader(audios, _preload, callback);

  function _preload(asset, doneCallback) {
    asset.audio = new Audio("audio/" + asset.id + "." + format);
    asset.audio.preload = "auto";
    asset.audio.addEventListener(
      "loadeddata",
      function () {
        // Loaded ok, set play function in object and set default volume
        asset.play = function () {
          asset.audio.play();
        };
        asset.audio.volume = 0.6;

        doneCallback();
      },
      false
    );

    asset.audio.addEventListener(
      "error",
      function (err) {
        // Failed to load, set dummy play function
        asset.play = function () {}; // dummy

        doneCallback(err, asset.id);
      },
      false
    );
  }
}

// Initializes audio and loads audio files
function initAudio(audios, callback) {
  var format = "mp3";
  var elem = document.createElement("audio");
  if (elem) {
    // Check if we can play mp3, if not then fall back to ogg
    if (!elem.canPlayType("audio/mpeg;") && elem.canPlayType("audio/ogg;"))
      format = "ogg";
  }

  var AudioContext =
    window.webkitAudioContext ||
    window.mozAudioContext ||
    window.MSAudioContext ||
    window.AudioContext;

  if (AudioContext) {
    $("#audio_debug").text("WebAudio Supported");
    // Browser supports webaudio
    // https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html
    return _initWebAudio(AudioContext, format, audios, callback);
  } else if (elem) {
    $("#audio_debug").text("HTML5 Audio Supported");
    // HTML5 Audio
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-video-element.html#the-audio-element
    return _initHTML5Audio(format, audios, callback);
  } else {
    $("#audio_debug").text("Audio NOT Supported");
    // audio not supported
    audios.forEach(function (item) {
      item.play = function () {}; // dummy play
    });
    callback();
  }
}

var IMAGE_HEIGHT = 64;
var IMAGE_TOP_MARGIN = 5;
var IMAGE_BOTTOM_MARGIN = 5;
var SLOT_SEPARATOR_HEIGHT = 2;
var SLOT_HEIGHT =
  IMAGE_HEIGHT + IMAGE_TOP_MARGIN + IMAGE_BOTTOM_MARGIN + SLOT_SEPARATOR_HEIGHT; // how many pixels one slot image takes
var RUNTIME = 3000; // how long all slots spin before starting countdown
var SPINTIME = 1000; // how long each slot spins at minimum
var ITEM_COUNT = 6; // item count in slots
var SLOT_SPEED = 15; // how many pixels per second slots roll
var DRAW_OFFSET = 45; // how much draw offset in slot display from top

var BLURB_TBL = ["No win!", "Good!", "Excellent!", "JACKPOT!"];

function SlotGame() {
  var game = new Game();

  var items = [
    { id: "energy-64" },
    { id: "staff-64" },
    { id: "cash-64" },
    { id: "build-64" },
    { id: "goods-64" },
    { id: "gold-64" },
  ];
  // Audio file names
  var audios = [
    { id: "roll" }, // Played on roll tart
    { id: "slot" }, // Played when reel stops
    { id: "win" }, // Played on win
    { id: "nowin" }, // Played on loss
  ];

  $("canvas").attr("height", IMAGE_HEIGHT * ITEM_COUNT * 2);
  $("canvas").css("height", IMAGE_HEIGHT * ITEM_COUNT * 2);

  game.items = items;
  game.audios = audios;

  var imagesLoaded = false;
  var audioLoaded = false;

  // load assets and predraw the reel canvases

  initAudio(audios, function () {
    // audio is initialized and loaded
    audioLoaded = true;
    checkLoad();
  });

  preloadImages(items, function () {
    // images are preloaded
    imagesLoaded = true;
    checkLoad();
  });

  function checkLoad() {
    if (!audioLoaded || !imagesLoaded) {
      return; // not yet ready
    }

    // all loaded

    // draws canvas strip
    function _fill_canvas(canvas, items) {
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ddd";

      for (var i = 0; i < ITEM_COUNT; i++) {
        var asset = items[i];
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.shadowBlur = 5;
        ctx.drawImage(asset.img, 3, i * SLOT_HEIGHT + IMAGE_TOP_MARGIN);
        ctx.drawImage(
          asset.img,
          3,
          (i + ITEM_COUNT) * SLOT_HEIGHT + IMAGE_TOP_MARGIN
        );
        ctx.restore();
        ctx.fillRect(0, i * SLOT_HEIGHT, 70, SLOT_SEPARATOR_HEIGHT);
        ctx.fillRect(
          0,
          (i + ITEM_COUNT) * SLOT_HEIGHT,
          70,
          SLOT_SEPARATOR_HEIGHT
        );
      }
    }
    // Draw the canvases with shuffled arrays
    game.items1 = copyArray(items);
    shuffleArray(game.items1);
    _fill_canvas(game.c1[0], game.items1);
    game.items2 = copyArray(items);
    shuffleArray(game.items2);
    _fill_canvas(game.c2[0], game.items2);
    game.items3 = copyArray(items);
    shuffleArray(game.items3);
    _fill_canvas(game.c3[0], game.items3);
    game.resetOffset = (ITEM_COUNT + 3) * SLOT_HEIGHT;

    // Start game loop
    game.loop();

    $("#play").click(function (e) {
      // start game on play button click
      $("h1").text("Rolling!");
      game.audios[0].play();
      game.restart();
    });
  }

  // Show reels for debugging
  var toggleReels = 1;
  $("#debug").click(function () {
    toggleReels = 1 - toggleReels;
    if (toggleReels) {
      $("#reels").css("overflow", "hidden");
    } else {
      $("#reels").css("overflow", "visible");
    }
  });

  return game;
}

window.requestAnimFrame = (function () {
  return (
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (/* function */ callback, /* DOMElement */ element) {
      window.setTimeout(callback, 1000 / 60);
    }
  );
})();
