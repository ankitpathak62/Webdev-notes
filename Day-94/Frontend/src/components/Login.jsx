import React from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";

const login = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = (data) => console.log(data);
  return (
    <>
      <div>
        <dialog id="my_modal_3" className="modal">
          <div className="modal-box">
            <form onSubmit={handleSubmit(onSubmit)} method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <Link
                to={"/"}
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              >
                ✕
              </Link>
              <h3 className="font-bold text-lg">Login</h3>
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
                   {errors.email && <span className="text-sm text-red-500">*This field is required*</span>}
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
                   {errors.password && <span className="text-sm text-red-500">*This field is required*</span>}
              </div>
              {/* button */}
              <div className="flex justify-around mt-4">
                <button className="bg-pink-500 text-white rounded-md px-3 py-1 hover:bg-pink-800 duration-200">
                  Login
                </button>
                <p>
                  Not register?{" "}
                  <Link
                    to={"/signup"}
                    className="underline text-blue-400 cursor-pointer hover:text-blue-800"
                  >
                    Signup
                  </Link>
                </p>
              </div>{" "}
            </form>
          </div>
        </dialog>
      </div>
    </>
  );
};

export default login;
