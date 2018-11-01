
function sayHello(){
    return _.template("Hello, <%= name %>!");
}

console.log(sayHello()({name: 'steve'}));