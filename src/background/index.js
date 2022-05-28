browser.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(async message => {
    console.log(message);
  });
});
