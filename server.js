const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const {userJoin, getCurrentUser,userLeave, getRoomUsers } = require('./utils/users');
const app = express();

var mongoose=require("mongoose"),
    flash=require("connect-flash");
    Room=require("./models/room");

var PORT=process.env.DATABASEURL || 'mongodb://localhost:27017/quickchat';
mongoose.connect(PORT, {
  useNewUrlParser: true,
  useUnifiedTopology: true,

}).then(()=>{
  console.log("Successfully connected to DB!");
}).catch(err=>{
  console.log(err.message);
});


app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = socketio(server);

const botName = 'ChatBot';

 //run when client connects
io.on('connection', socket => {
socket.on('joinRoom', ({ username, room }) => {
const user = userJoin(socket.id, username, room);
socket.join(user.room);

//Find previous messages of the room and emit them, or create a new room
		Room.findOne({name:room}, function(err, ROOM){
			if(ROOM && ROOM.messages){
				ROOM.messages.forEach(function(MSG){
					socket.emit("message", MSG);
				});
			}else{
				socket.emit("message", formatMessage(botName,"Started new Room!"));
				var newroom={
					name:user.room
				}
				Room.create(newroom, function(err,room){
				});
			}
		});


    socket.emit('message', formatMessage(botName, 'welcome to QuickChat!'));

  //broadcast when a user connects
    socket.broadcast.to(user.room).emit('message', formatMessage(botName, `${user.username} has joined the chat`));
//
//Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });


  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);
    Room.updateOne(
  		    { name: user.room },
  		    { $push: { messages: [formatMessage(user.username, msg)] } },
  		    function(err, result) {
  		      if (err) {
  		        console.log(err);
  		      } else {
  		        console.log(result);
  		      }
  		    }
  		  );
    io.to(user.room).emit('message',formatMessage(user.username, msg));
  });

  //runs when client disconnects
    socket.on('disconnect', () => {
      const user = userLeave(socket.id);

      if(user) {
      io.to(user.room).emit('message', formatMessage(botName, `${user.username} has left the chat`));

    // Send users and room info
        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users: getRoomUsers(user.room)
        });
      }
    });
  });

var PORT =  3000 || process.env.PORT;

server.listen(PORT, () => console.log('Server running on port ${PORT}'));
