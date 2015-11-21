var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function() {
  console.log('Server is listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connecting to the chat
var usernames = {};
var numUsers = 0;

// Listen event when a socket connected to server
io.on('connection', function(socket) {
  var joinedUser = false;

  // Receive messages from client
  socket.on('new message', function(msg) {

    // Emit messages to everyone except the sender
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: msg
    });
  });

  // Add user
  socket.on('add user', function(username) {

    // Check unique username
    if (usernames[username]) {
      socket.emit('err', {
        message: 'This username already exists. Please use another username!'
      });
    } else {
      // Store the username in the socket session for this client
      socket.username = username;

      // Add the client's username to global list
      usernames[username] = username;

      ++numUsers;
      joinedUser = true;

      // Emit to client which is currently connecting to server
      socket.emit('login', {
        numUsers: numUsers
      });

      // Emit to all clients that a user has connected except client which is currently connecting to server
      socket.broadcast.emit('user joined', {
        username: socket.username,
        numUsers: numUsers
      });

      // Emit globally current online users
      io.emit('online users', {
        usernames: usernames
      });
    }
  });

  // When a user is tying, we will broadcast it to others
  socket.on('typing', function() {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // When a user stops typing, we will also broadcast it to others
  socket.on('stop typing', function() {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // When a user disconnected to the server
  socket.on('disconnect', function() {

    // Remove the user from global usernames list
    if (joinedUser) {
      delete usernames[socket.username];
      --numUsers;

      // Emit globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });

      // Emit globally current online users
      io.emit('online users', {
        usernames: usernames
      });
    }
  });

});