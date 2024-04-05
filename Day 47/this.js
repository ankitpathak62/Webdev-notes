// "use strict"

//Global Space
console.log(this);

//This Keyword in Function

function ABC() {
  console.log(this);
}
ABC();
window.ABC();

//This keyword can also call inside object's method

const dsa = {
  a: 10,
  b: function () {
    console.log(this);
  },
};
dsa.b()

const fds = {
  a: 20,
};
// dsa.b.call(fds)

//This Keyword in arrow function

const dsaa = {
  a: 10,
  b: () => {
    console.log(this);
  },
  c: function () {
    const b = () => {
      console.log(this);
    };
    b();
  },
};
dsaa.b()
dsaa.c();
