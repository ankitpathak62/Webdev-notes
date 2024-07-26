import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Login from "./Login";
import axios from "axios";
import toast from "react-hot-toast";

const Signup = () => {
  const loaction = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    const userInfo = {
      fullname: data.fullname,
      email: data.email,
      password: data.password,
    };
    await axios
      .post("http://localhost:5001/user/signup", userInfo)
      .then((res) => {
        console.log(res.data);
        if (res.data) {
          toast.success("signup successfull");
          navigate(from, { replace: true });
        }
        localStorage.setItem("User", JSON.stringify(res.data.user));
      })
      .catch((err) => {
        console.log(err);
        toast.error("Error in signup " + err);
      });
  };
  return (
    <>
      <div className="flex h-screen items-center justify-center">
        <div className=" w-[600px]">
          <div className="modal-box">
            <form onSubmit={handleSubmit(onSubmit)} method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <Link
                to={"/"}
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              >
                ✕
              </Link>
              <h3 className="font-bold text-lg">Signup</h3>
              <div className="mt-4">
                <span>Name</span>
                <br></br>
                <input
                  type="fullname"
                  placeholder="Enter Your Full Name"
                  className="px-3 py-1 w-80 rounded-md border outline-none"
                  {...register("fullname", { required: true })}
                ></input>
                <br></br>
                {errors.fullname && (
                  <span className="text-sm text-red-500">
                    *This field is required*
                  </span>
                )}
              </div>
              {/* Email */}
              <div className="mt-4">
                <span>Email</span>
                <br></br>
                <input
                  type="email"
                  placeholder="Enter Your Email"
                  className="px-3 py-1 w-80 rounded-md border outline-none"
                  {...register("email", { required: true })}
                ></input>
                <br></br>
                {errors.email && (
                  <span className="text-sm text-red-500">
                    *This field is required*
                  </span>
                )}
              </div>
              {/* Password */}
              <div className="mt-4">
                <span>Password</span>
                <br></br>
                <input
                  type="password"
                  placeholder="Enter Your Password"
                  className="px-3 py-1 w-80 rounded-md border outline-none"
                  {...register("password", { required: true })}
                ></input>
                <br></br>
                {errors.password && (
                  <span className="text-sm text-red-500">
                    *This field is required*
                  </span>
                )}
              </div>
              {/* button */}
              <div className="flex justify-around mt-4">
                <button className="bg-pink-500 text-white rounded-md px-3 py-1 hover:bg-pink-800 duration-200">
                  Signup
                </button>
                <p className="text-xl">
                  Already Account{" "}
                  <button
                    className="underline text-blue-400 cursor-pointer hover:text-blue-800"
                    onClick={() =>
                      document.getElementById("my_modal_3").showModal()
                    }
                  >
                    Login
                  </button>
                  <Login />
                </p>
              </div>{" "}
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
