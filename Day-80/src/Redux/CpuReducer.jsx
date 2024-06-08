import { Buy_CPU } from "./Cputype";

const initialState = {
  NumberofCpu: 200,
};

const CpuReducer = (state = initialState, action) => {
  switch (action.type) {
    case Buy_CPU:
      return {
        ...state,
        NumberofCpu: state.NumberofCpu - 1, // Decrement the NumberofCpu by 1
      };
    default:
      return state;
  }
};

export { CpuReducer };
