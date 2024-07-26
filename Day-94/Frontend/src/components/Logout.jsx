import React from "react";
import { useAuth } from "../Context/AuthProvider";
import toast from "react-hot-toast";

function Logout() {
  const [authUser, setAuthUser] = useAuth();

  const handleLogout = () => {
    try {
      setAuthUser({
        ...authUser,
        user: null,
      });
      localStorage.removeItem("User");
      toast.success("Logout Successfull");
      window.location.reload();
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  return (
    <div>
      <button
        className="px-3 py-2 text-white bg-red-500 rounded-md cursor-pointer"
        onClick={handleLogout}
      >
        Logout
      </button>
    </div>
  );
}

export default Logout;
