

function button(){
    var x = document.getElementById("input").value;
    document.getElementById("response").innerHTML = x;
    if (!isNaN(x)){
        console.log(x);
        document.getElementById("response").innerHTML = Math.floor(Math.random() * x);
    }
}

(function () {
    var old = console.log;
    var logger = document.getElementById('log');
    console.log = function () {
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == 'object') {
            logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + '<br />';
        } else {
            logger.innerHTML += arguments[i] + '<br />';
        }
      }
    }
})();

function runJS(){
    var x = document.getElementById("inputJS").value;
    eval(x);
}

console.log('hi');
