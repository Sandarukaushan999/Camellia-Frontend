import axios from "axios";
import { resolveApiBaseUrl } from "./apiBase.js";

const publicApi = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 20000,
});

export default publicApi;
