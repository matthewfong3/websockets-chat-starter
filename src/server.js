const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read the client html file into memory
// __dirname in node is the current directory
// (in this case the same folder as the server.js file)
const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`listening on 127.0.0.1: ${port}`);

// pass in the http server into socketio and grab the websocket server as io
const io = socketio(app);

// object to hold all of our connected users
const users = {};
// users.name = [];

// helper function: for action commands
const processActionCommands = (socket, data) => {
  const msgArray = data.msg.split(' ');

  const returnObj = {};
  returnObj.name = 'server';

  if (msgArray[0] === '/me') {
    const command = msgArray[1];

    switch (command) {
      case 'dance':
        returnObj.msg = `${socket.name} dances`;
        return returnObj;
      case 'sing':
        returnObj.msg = `${socket.name} sings`;
        return returnObj;
      case 'snooze':
        returnObj.msg = `${socket.name} went to bed`;
        return returnObj;
      default:
        returnObj.msg = 'not valid';
        return returnObj;
    }
  } else if (msgArray[0] === '/commands') {
    returnObj.msg = 'commands';
    return returnObj;
  } else if (msgArray[0] === '/dice') {
    const roll = Math.floor(Math.random() * (6 - 1)) + 1;
    returnObj.msg = `${socket.name} rolled a ${roll} on a 6 sided die`;
    return returnObj;
  } else {
    returnObj.name = socket.name;
    returnObj.msg = data.msg;
    return returnObj;
  }
};

// fires when server is receiving new join requests from clients
const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    // message back to new user
    const joinMsg = {
      name: 'server',
      msg: `There are ${Object.keys(users).length} users online`,
    };

    socket.name = data.name;
    socket.emit('msg', joinMsg);

    socket.join('room1');

    // add (individual person/client) to users object  
    // users.name.push(data.name);
    users[socket.name] = socket.name;
   
    // announcement to everyone in the room
    const response = {
      name: 'server',
      msg: `${data.name} has joined the room.`,
    };

    socket.broadcast.to('room1').emit('msg', response);

    // success message back to new user
    socket.emit('msg', { name: 'server', msg: 'You joined the room' });
  });
};

// fires when server is receiving messages from clients
const onMsg = (sock) => {
  const socket = sock;

  socket.on('msgToServer', (data) => {
    const msgObj = processActionCommands(socket, data);

    if (msgObj.msg === 'not valid') socket.emit('msg', { name: msgObj.name, msg: 'That is not a valid command' });
    else if (msgObj.msg === 'commands') socket.emit('msg', { name: msgObj.name, msg: 'Action Commands include:\n1)/me dance\n2)/me sing\n3)/me snooze\n4)/dice' });
    else io.sockets.in('room1').emit('msg', { name: msgObj.name, msg: msgObj.msg });
  });
};

// fires when server receives a request from a user to change their username
const onChange = (sock) => {
  const socket = sock;

  socket.on('changeToServer', (data) => {
    // if users obj contains the client name, allow them to change their names
    if (users[data.name]) {
      const response = {
        name: 'server',
        msg: `${socket.name} has changed name to ${data.changedName}.`,
      };
      delete users[socket.name];
      socket.name = data.changedName;
      users[socket.name] = socket.name;
      io.sockets.in('room1').emit('msg', response);
    } else {
      socket.emit('msg', { name: 'server', msg: 'Failed to change username' });
    }
  });
};

// fires when server receives an onDisconnect request from a user/client
const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    // const index = users.name.indexOf(socket.name);
    // users.name.splice(index, 1);

    const message = `${socket.name} has left the room.`;

    socket.broadcast.to('room1').emit('msg', { name: 'server', msg: message });

    socket.leave('room1');

    delete users[socket.name];
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  onJoined(socket);
  onMsg(socket);
  onChange(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');
