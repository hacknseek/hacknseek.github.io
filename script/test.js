console.log('hi');


function button(){
    var x = document.getElementById("input").value;
    document.getElementById("response").innerHTML = x;
    if (!isNaN(x)){
        console.log('x');
        document.getElementById("response").innerHTML = Math.floor(Math.random() * x);
    }
}