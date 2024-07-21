import React from "react";
import Card from "./Card";
import list from "../../public/list.json";

const CoursePaid = () => {
  return (
    <>
      <div className="max-w-screen-2xl container mx-auto md:px-20 px-4">
        <div className="mt-28 items-center justify-center text-center">
          <h1 className="text-2xl font-semibold md:text-4xl">
            Some Paid Courses
          </h1>
          <p className="mt-12">
            Lorem ipsum dolor, sit amet consectetur adipisicing elit. Aperiam,
            totam, inventore sit beatae repellendus reprehenderit accusamus
            pariatur quaerat dolor quam consectetur ea omnis expedita
            accusantium optio voluptas quae veritatis perspiciatis?
          </p>
        </div>

        <div className=" mt-12 grid grid-cols-1 md:grid-cols-3">
          {list.map((item) => (
            <Card key={item.id} item={item}></Card>
          ))}
        </div>
      </div>
    </>
  );
};

export default CoursePaid;
