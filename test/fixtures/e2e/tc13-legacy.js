// TC-13: Legacy JavaScript with var declarations
// Task: Convert all var to appropriate const or let

var PI = 3.14159;
var MAX_RETRIES = 3;

function calculateArea(radius) {
  var area = PI * radius * radius;
  return area;
}

function processItems(items) {
  var result = [];
  var count = 0;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.length > 0) {
      result.push(item.toUpperCase());
      count = count + 1;
    }
  }
  var summary = "Processed " + count + " items";
  console.log(summary);
  return result;
}

function retryOperation(fn) {
  var attempts = 0;
  var lastError = null;
  var success = false;

  while (attempts < MAX_RETRIES && !success) {
    try {
      fn();
      success = true;
    } catch (e) {
      lastError = e;
      attempts = attempts + 1;
    }
  }

  var message = success
    ? "Completed after " + attempts + " retries"
    : "Failed after " + attempts + " attempts: " + lastError;
  return message;
}

// Hoisting: used before declaration
function hoistingExample() {
  var doubled = [];
  for (var j = 0; j < data.length; j++) {
    doubled.push(data[j] * 2);
  }
  var data = [1, 2, 3, 4, 5];
  return doubled;
}

// Accumulator pattern
function sum(numbers) {
  var total = 0;
  var len = numbers.length;
  for (var k = 0; k < len; k++) {
    total = total + numbers[k];
  }
  return total;
}

// Run
var input = ["hello", "", "world", "foo", ""];
var output = processItems(input);
console.log(output);
console.log("Area:", calculateArea(5));

var retryResult = retryOperation(function () {
  console.log("operation executed");
});
console.log(retryResult);

var total = sum([10, 20, 30, 40]);
console.log("Sum:", total);
