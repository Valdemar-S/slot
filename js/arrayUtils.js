function copyArray(array) {
  var copy = [];
  for (var i = 0; i < array.length; i++) {
    copy.push(array[i]);
  }
  return copy;
}

function shuffleArray(array) {
  var i;

  for (i = array.length - 1; i > 0; i--) {
    var j = parseInt(Math.random() * i);
    var tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}
