import { Buy_CPU } from "./Cputype";

const initialState = {
  NumberofCpu: 20,
};

const CpuReducer = (state = initialState, action) => {
  switch (action.type) {
    case Buy_CPU:
      return {
        ...state,
        NumberofCpu: initialState - 1,
      };
    default:
      return state;
  }
};
export default CpuReducer;
