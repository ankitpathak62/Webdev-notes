import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleFormSubmit = (event) => {
    event.preventDefault();
    navigate(`/room/${roomCode}`);
  };
  return (
    <>
      <div className="homepage">
        <form onSubmit={handleFormSubmit} className="form">
          <div>
            <label>Enter Room Code</label>

            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              type="text"
              name="roomCode"
              required
              placeholder="Enter Your RoomCode"
            />
          </div>
          <button type="submit">Enter Room</button>
        </form>
      </div>
    </>
  );
}

export default Home;
