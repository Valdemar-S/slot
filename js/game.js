function Game() {
  // reel canvases
  this.c1 = $("#canvas1");
  this.c2 = $("#canvas2");
  this.c3 = $("#canvas3");

  // set random canvas offsets
  this.offset1 = -parseInt(Math.random() * ITEM_COUNT) * SLOT_HEIGHT;
  this.offset2 = -parseInt(Math.random() * ITEM_COUNT) * SLOT_HEIGHT;
  this.offset3 = -parseInt(Math.random() * ITEM_COUNT) * SLOT_HEIGHT;
  this.speed1 = this.speed2 = this.speed3 = 0;
  this.lastUpdate = new Date();

  // Needed for CSS translates
  this.vendor = /webkit/i.test(navigator.appVersion)
    ? "-webkit"
    : /firefox/i.test(navigator.userAgent)
    ? "-moz"
    : /msie/i.test(navigator.userAgent)
    ? "ms"
    : "opera" in window
    ? "-o"
    : "";

  this.cssTransform = this.vendor + "-transform";
  this.has3d = "WebKitCSSMatrix" in window && "m11" in new WebKitCSSMatrix();
  this.trnOpen = "translate" + (this.has3d ? "3d(" : "(");
  this.trnClose = this.has3d ? ",0)" : ")";
  this.scaleOpen = "scale" + (this.has3d ? "3d(" : "(");
  this.scaleClose = this.has3d ? ",0)" : ")";

  // draw the slots to initial locations
  this.draw(true);
}

Game.prototype.setOnlineStatus = function (isOnline) {
  this.isOnline = !!isOnline; // forces to true or false
  var msg;
  if (this.isOnline) {
    msg = "Game is ONLINE";
  } else {
    msg = "Game is OFFLINE";
  }
  $("#online_debug").text(msg);
};

// Restart the game and determine the stopping locations for reels
Game.prototype.restart = function () {
  this.lastUpdate = new Date();
  this.speed1 = this.speed2 = this.speed3 = SLOT_SPEED;

  // function locates id from items
  function _find(items, id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id == id) return i;
    }
  }

  // uncomment to get always jackpot
  //this.result1 = _find( this.items1, 'gold-64' );
  //this.result2 = _find( this.items2, 'gold-64' );
  //this.result3 = _find( this.items3, 'gold-64' );

  // get random results
  this.result1 = parseInt(Math.random() * this.items1.length);
  this.result2 = parseInt(Math.random() * this.items2.length);
  this.result3 = parseInt(Math.random() * this.items3.length);

  // Clear stop locations
  this.stopped1 = false;
  this.stopped2 = false;
  this.stopped3 = false;

  // randomize reel locations
  this.offset1 = -parseInt(Math.random(ITEM_COUNT)) * SLOT_HEIGHT;
  this.offset2 = -parseInt(Math.random(ITEM_COUNT)) * SLOT_HEIGHT;
  this.offset3 = -parseInt(Math.random(ITEM_COUNT)) * SLOT_HEIGHT;

  $("#results").hide();

  this.state = 1;
};

Game.prototype.loop = function () {
  var that = this;
  that.running = true;
  (function gameLoop() {
    that.update();
    that.draw();
    if (that.running) {
      requestAnimFrame(gameLoop);
    }
  })();
};

Game.prototype.update = function () {
  var now = new Date();
  var that = this;

  // Check slot status and if spun long enough stop it on result
  function _check_slot(offset, result) {
    if (now - that.lastUpdate > SPINTIME) {
      var c = parseInt(Math.abs(offset / SLOT_HEIGHT)) % ITEM_COUNT;
      if (c == result) {
        if (result == 0) {
          if (Math.abs(offset + ITEM_COUNT * SLOT_HEIGHT) < SLOT_SPEED * 1.5) {
            return true; // done
          }
        } else if (Math.abs(offset + result * SLOT_HEIGHT) < SLOT_SPEED * 1.5) {
          return true; // done
        }
      }
    }
    return false;
  }

  switch (this.state) {
    case 1: // all slots spinning
      if (now - this.lastUpdate > RUNTIME) {
        this.state = 2;
        this.lastUpdate = now;
      }
      break;
    case 2: // slot 1
      this.stopped1 = _check_slot(this.offset1, this.result1);
      if (this.stopped1) {
        this.speed1 = 0;
        this.state++;
        this.lastUpdate = now;
        this.audios[1].play();
      }
      break;
    case 3: // slot 1 stopped, slot 2
      this.stopped2 = _check_slot(this.offset2, this.result2);
      if (this.stopped2) {
        this.speed2 = 0;
        this.state++;
        this.lastUpdate = now;
        this.audios[1].play();
      }
      break;
    case 4: // slot 2 stopped, slot 3
      this.stopped3 = _check_slot(this.offset3, this.result3);
      if (this.stopped3) {
        this.speed3 = 0;
        this.state++;
        this.audios[1].play();
      }
      break;
    case 5: // slots stopped
      if (now - this.lastUpdate > 3000) {
        this.state = 6;
      }
      break;
    case 6: // check results
      var ec = 0;

      $("#results").show();
      if (that.items1[that.result1].id == "gold-64") ec++;
      if (that.items2[that.result2].id == "gold-64") ec++;
      if (that.items3[that.result3].id == "gold-64") ec++;
      $("#multiplier").text(ec);
      $("#status").text(BLURB_TBL[ec]);

      if (ec) {
        // Play win sound
        this.audios[2].play();
      } else {
        // Play no-win sound
        this.audios[3].play();
      }

      this.state = 7;
      break;
    case 7: // game ends
      break;
    default:
  }
  this.lastupdate = now;
};

Game.prototype.draw = function (force) {
  if (this.state >= 6) return;

  // draw the spinning slots based on current state
  for (var i = 1; i <= 3; i++) {
    var resultp = "result" + i;
    var stopped = "stopped" + i;
    var speedp = "speed" + i;
    var offsetp = "offset" + i;
    var cp = "c" + i;
    if (this[stopped] || this[speedp] || force) {
      if (this[stopped]) {
        this[speedp] = 0;
        var c = this[resultp]; // get stop location
        this[offsetp] = -(c * SLOT_HEIGHT);

        if (this[offsetp] + DRAW_OFFSET > 0) {
          // reset back to beginning
          this[offsetp] = -this.resetOffset + SLOT_HEIGHT * 3;
        }
      } else {
        this[offsetp] += this[speedp];
        if (this[offsetp] + DRAW_OFFSET > 0) {
          // reset back to beginning
          this[offsetp] = -this.resetOffset + SLOT_HEIGHT * 3 - DRAW_OFFSET;
        }
      }
      // translate canvas location
      this[cp].css(
        this.cssTransform,
        this.trnOpen +
          "0px, " +
          (this[offsetp] + DRAW_OFFSET) +
          "px" +
          this.trnClose
      );
    }
  }
};
