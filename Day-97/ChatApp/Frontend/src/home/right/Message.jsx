import React from "react";

function Message({ message }) {
  const authUser = JSON.parse(localStorage.getItem("messenger")) || {};
  console.log(authUser);
  const itsMe = authUser.user && authUser.user._id === message.senderId;
  console.log(message);  
  console.log(authUser.user);

  const chatAlignment = itsMe ? "chat-end" : "chat-start";
  const chatColor = itsMe ? "bg-blue-500" : "bg-gray-500";

  const createdAt = new Date(message.createdAt);
  const formattedTime = createdAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div className="p-4">
        <div className={`chat ${chatAlignment}`}>
          <div className={`chat-bubble text-white ${chatColor}`}>
            {message.message}
          </div>
          <div className="chat-footer">{formattedTime}</div>
        </div>
      </div>
    </div>
  );
}

export default Message;

 