(function() {
  'use strict';

  var FADE_TIME = 200;  // ms
  var TYPING_TIMER_LENGTH = 500;  // ms

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput');   // Input for username
  var $messages = $('.messages');             // Messages area
  var $onlineUsers = $('.onlineUsers');       // Online Users area
  var $inputMessage = $('.inputMessage');     // Input chat message

  var $loginPage = $('.login.page');          // The login page
  var $chatPage = $('.chat.page');            // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus(); // Focus on Username input in Login page by default

  var socket = io();

  ///////   HELPERS   ///////

  /*
   * @description   Adds a message element to the messages and scrolls to the bottom
   * @param  {ele}  The element to add as a message
   * @param  {options.fade}  If the element should fade-in (default = true)
   * @param  {options.prepend}  If the element should prepend all other messages (default = false)
   */
  function addMessageElement(ele, options) {
    var $ele = $(ele);

    // Setup default options
    if (!options) {
      options = {};
    }

    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }

    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $ele.hide().fadeIn(FADE_TIME);
    }

    if (options.prepend) {
      $messages.prepend($ele);
    } else {
      $messages.append($ele);
    }

    // Scroll messages to bottom
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevent markup from being injected into the message
  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  // Show notification when user connected or disconnected chat room
  function displayNotification(message, options) {
    var ele = $('<li>').addClass('notification').text(message);
    addMessageElement(ele, options);
  }

  // Show current total of online users
  function displayTotalParticipants(numUsers) {
    var message = '';

    if (numUsers === 1) {
      message = 'There is one participant';
    } else {
      message = 'There are ' + numUsers + ' participants';
    }

    displayNotification(message);
  }

  // Show all online users
  function displayOnlineUsers(users) {
    $onlineUsers.html('');
    $onlineUsers.prepend($('<li/>').text('List online users'));

    for (var user in users) {
      $onlineUsers.append($('<li/>').text(users[user]));
    }
  }

  ///////   CHAT MESSAGES   ///////

  function addChatMessage(data, options) {
    var $typingMessages = getTypingMessages(data);
    options = options || {};

    // Don't fade the message in if there is an 'X was typing'
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>').text(data.username);
    var $messageBodyDiv = $('<span class="messageBody"/>').text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages(data) {
    return $('.typing.message').filter(function() {
      return $(this).data('username') === data.username;
    });
  }

  ///////   TYPING FUNCTIONS   ///////

  // Adds the visual chat typing message
  function addChatTyping(data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping(data) {
    getTypingMessages(data).fadeOut(function() {
      $(this).remove();
    });
  }

  // Updates the typing event
  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }

      lastTypingTime = (new Date()).getTime();

      setTimeout(function() {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;

        if (typing && (timeDiff >= TYPING_TIMER_LENGTH)) {
          typing = false;
          socket.emit('stop typing');
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  ///////   MAIN FUNCTIONS   ///////

  // Sets the client's username
  function setUsername() {
    username = cleanInput($usernameInput.val().trim());

    if (username) {
      // Emit new username to server
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage() {
    var message = cleanInput($inputMessage.val());

    // If there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });

      // Emit to sever about new message
      socket.emit('new message', message);
    }
  }

  // Keyboard events
  $window.keydown(function(event) {

    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }

    // When the user hits ENTER on their keyboard
    if (event.which === 13) {
      if (username && connected) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  // Triggers event whenever the input changes
  $inputMessage.on('input', function() {
    updateTyping();
  });

  ///////   CLICK EVENTS   ///////

  // Focus input when clicking anywhere on login page
  $loginPage.click(function() {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function() {
    $inputMessage.focus();
  });

  ///////   SOCKET (EVENT) FUNCTIONS   ///////

  socket.on('login', function(data) {
    $loginPage.fadeOut();
    $loginPage.off('click');    // Remove click event for loginPage
    $chatPage.show();
    $currentInput = $inputMessage.focus();

    connected = true;
    displayNotification('Welcome to chat room', {prepend: true});
    displayTotalParticipants(data.numUsers);
  });

  socket.on('new message', function(data) {
    addChatMessage(data);
  });

  socket.on('user joined', function(data) {
    displayNotification(data.username + ' joined');
    displayTotalParticipants(data.numUsers);
  });

  socket.on('user left', function(data) {
    displayNotification(data.username + ' left');
    displayTotalParticipants(data.numUsers);
    removeChatTyping(data);
  });

  socket.on('online users', function(data) {
    displayOnlineUsers(data.usernames);
  });

  socket.on('typing', function(data) {
    addChatTyping(data);
  });

  socket.on('stop typing', function(data) {
    removeChatTyping(data);
  });

  socket.on('err', function(data) {
    alert(data.message);
  });
})();