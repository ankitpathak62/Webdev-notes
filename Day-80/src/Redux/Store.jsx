import { createStore } from "redux";
import {CpuReducer} from "./CpuReducer"

const store = createStore(CpuReducer);

export default store;
