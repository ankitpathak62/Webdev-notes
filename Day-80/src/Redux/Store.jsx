import { createStoreHook } from "react-redux";
import { CpuReducer } from "./CpuReducer";

const Store = createStoreHook(CpuReducer);

export default Store;
