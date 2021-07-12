Chats = new Mongo.Collection("chats");

if (Meteor.isClient) {

  // set up the main template the the router will use to build pages
  Router.configure({
    layoutTemplate: 'ApplicationLayout'
  });

  // specify the top level route, the page users see when they arrive at the site
  Router.route('/', function () {
    console.log("rendering root /");
    this.render("navbar", {to:"header"});
    this.render("lobby_page", {to:"main"});
  }, {
    waitOn: function() {
      return Meteor.subscribe("users");
    }
  });

  // specify a route that allows the current user to chat to another users
  Router.route('/chat/:_id', function () {
    if (!this.ready()){
      return;
    }
    // the user they want to chat to has id equal to
    // the id sent in after /chat/...
    var otherUserId = this.params._id;

    // find a chat that has two users that match current user id
    // and the requested user id
    var userId = Meteor.userId();
    var chat = Chats.findOne({
      $or: [
        {
          user1Id: userId,
          user2Id: otherUserId
        },
        {
          user1Id: otherUserId,
          user2Id: userId
        }
      ]
    });

    if (!chat) {// no chat matching the filter - need to insert a new one
      chatId = Meteor.call("createChatRoom", otherUserId);
    }
    else {// there is a chat going already - use that.
      chatId = chat._id;
    }
    if (chatId) {// looking good, save the id to the session
      Session.set("chatId", chatId);
    }
    this.render("navbar", {to: "header"});
    this.render("chat_page", {to: "main"});
  }, {
    waitOn: function () {
      return [
        Meteor.subscribe("chats"),
        Meteor.subscribe("users")
      ];
    },
    onBeforeAction: function(){
      if (!Meteor.userId() && !Meteor.loggingIn()){
        Router.go('/');
      } else {
        this.next();
      }
    },
  });
  ///
  // helper functions 
  /// 
  Template.available_user_list.helpers({
    users:function(){
      return Meteor.users.find();
    }
  });
 Template.available_user.helpers({
    getUsername:function(userId){
      user = Meteor.users.findOne({_id:userId});
      return user.profile.username;
    }, 
    isMyUser:function(userId){
      if (userId == Meteor.userId()){
        return true;
      }
      else {
        return false;
      }
    }
  });

  Template.chat_message.helpers({
    getUserAvatar: function(userId) {
      var user = Meteor.users.findOne({_id:userId});
      return user.profile.avatar;
    }
  });

  Template.chat_page.helpers({
    messages:function(){
      var chat = Chats.findOne({_id:Session.get("chatId")});
      return chat.messages;
    }, 
    other_user:function(){
      return ""
    }
  });
 Template.chat_page.events({
  // this event fires when the user sends a message on the chat page
  'submit .js-send-chat':function(event){
    // stop the form from triggering a page reload
    event.preventDefault();

    var text_msg = event.target.chat.value;
    // skip if message is empty
    if (text_msg.trim() === ""){
      return;
    }

    // see if we can find a chat object in the database
    // to which we'll add the message
    var chat = Chats.findOne({_id:Session.get("chatId")});
    if (chat){// ok - we have a chat to use
      var msgs = chat.messages; // pull the messages property
      if (!msgs){// no messages yet, create a new array
        msgs = [];
      }
      // is a good idea to insert data straight from the form
      // (i.e. the user) into the database?? certainly not. 
      // push adds the message to the end of the array
      msgs.push({text: text_msg, userId: Meteor.userId()});
      // reset the form
      event.target.chat.value = "";
      // put the messages array onto the chat object
      chat.messages = msgs;
      // update the chat object in the database.
      Meteor.call("updateChat", chat);
    }
  }
 })
}


// start up script that creates some users for testing
// users have the username 'user1@test.com' .. 'user8@test.com'
// and the password test123 

if (Meteor.isServer) {
  Meteor.startup(function () {
    if (!Meteor.users.findOne()) {
      for (var i = 1; i < 9; i++) {
        var email = "user"+i+"@test.com";
        var username = "user"+i;
        var avatar = "ava"+i+".png";

        console.log("creating a user with password 'test123' and username/ email: " + email);

        Meteor.call("addUser", username, avatar, email);
      }
    } 
  });

  Meteor.publish("users", function() {
    return Meteor.users.find({});
  });

  Meteor.publish("chats", function() {
    return Chats.find({
      $or:[
        {
          user1Id: this.userId
        },
        {
          user2Id: this.userId
        }
      ]
    });
  });
}

// method layer
Meteor.methods({
  createChatRoom: function(otherUserId) {
    return Chats.insert({
      user1Id: Meteor.userId(),
      user2Id: otherUserId
    });
  },
  updateChat: function(chat) {
    Chats.update(chat._id, chat);
  },
  addUser: function(username, avatar, email) {
    Meteor.users.insert({
      profile:{
        username:username,
        avatar:avatar
      },
      emails:[
        {
          address:email
        }
      ],
      services:{
        password:{"bcrypt" : "$2a$10$I3erQ084OiyILTv8ybtQ4ON6wusgPbMZ6.P33zzSDei.BbDL.Q4EO"}
      }
    });
  }
});
