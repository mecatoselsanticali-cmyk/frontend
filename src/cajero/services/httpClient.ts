import axios from "axios";

export const posHttp = axios.create({
  baseURL: import.meta.env.VITE_POS_API_URL || "http://localhost:4000/api/pos",
  withCredentials: true,
  timeout: 8000,
});

posHttp.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginCall = error.config?.url?.includes("/auth/login");
    const isMeCall = error.config?.url?.includes("/auth/me");

    if (
      error.response?.status === 401 &&
      !isLoginCall &&
      !isMeCall &&
      window.location.pathname !== "/login"
    ) {
      window.location.href = "/login";
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Error de red";
    return Promise.reject(new Error(message));
  }
);
