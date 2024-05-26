import React from "react";
import { PROJECTS } from "../constants";
import { motion } from "framer-motion";

const Project = () => {
  return (
    <div className="border-b border-neutral-900 pb-4">
      <motion.h1
        whileInView={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: -100 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="my-20 text-center text-4xl"
      >
        Project
      </motion.h1>
      <motion.div
        whileInView={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        {PROJECTS.map((project, index) => (
          <div key={index} className="mb-8 flex flex-wrap lg:justify-center">
            <div className="w-full lg:w-1/4">
              <motion.img
                whileInView={{ opacity: 1, x: 100 }}
                initial={{ opacity: 0, x: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                src={project.image}
                width={150}
                height={150}
                alt={project.title}
                className="mb-6 rounded"
              />
            </div>
            <motion.div
              whileInView={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="w-full max-w-xl lg:w-3/4"
            >
              <h6 className="mb-2 font-semibold">{project.title}</h6>
              <p className="mb-4 text-neutral-350">{project.description}</p>
              {project.technologies.map((tech, index) => (
                <span
                  key={index}
                  className="mr-2 rounded bg-neutral-800 px-2 py-1 text-sm font-medium"
                >
                  {tech}
                </span>
              ))}
            </motion.div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default Project;
