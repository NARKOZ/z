io.SessionSocket = function(host){
  io.Socket.apply(this, [host, {transports: ['xhr-polling']}]);
  this._sessionId = CONNECT_SID;
  this.on('connect', function(){
    this.send({__sid:this._sessionId, connect:1});
  });
};
io.util.inherit(io.SessionSocket, io.Socket);
