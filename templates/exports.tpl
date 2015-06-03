//
//  You can export commands to the outside world by adding them to the $app.exports hash:
//
//  $app.exports.helloworld = function(who, options) {
//    var text = `Hello ${who}. Welcome to Nami!`;
//    if (options.shout) text = text.toUpperCase();
//    console.log(text);
//  };
//
//  To make them public, don't forget to also add them to the "exports" section in nami.json.
//  The matching definition to add for the above "$app.exports.helloworld" example would look like:
//
//  "exports": {
//     ...
//     "helloworld" : {"arguments": ["who"], "options": {"shout": {"type": "boolean"}}}
//     ...
//  }
//
//  This "helloworld" command will be available both from command line and from JS scripts using your module:
//
//  $> nami execute sample helloworld --shout Beltran
//  HELLO BELTRAN. WELCOME TO NAMI!
//
//  Or:
//
//  sample.exports.helloworld("beltran", {shout: true});
//
//
//  Of course, if you are not expecting arguments, you can just use:
//
//  "exports": {
//     ...
//     "ping" : null
//     ...
//  }
//
//  And define your function as:
//
//  $app.exports.ping = function() {
//    console.log("PONG!");
//  };
//
