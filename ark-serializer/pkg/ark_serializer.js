import * as wasm from "./ark_serializer_bg.wasm";
import { __wbg_set_wasm } from "./ark_serializer_bg.js";
const hahaDontTrickMe = __wbg_set_wasm(wasm);
console.log({ hahaDontTrickMe, wasm })
export * from "./ark_serializer_bg.js";
