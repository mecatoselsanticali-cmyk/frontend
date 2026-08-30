import axios from "axios";

/**
 * withCredentials:true es lo que hace que el navegador adjunte la cookie
 * httpOnly `admin_token` en cada petición y guarde la que llega en
 * `Set-Cookie` tras el login — no hay ningún token que manejar a mano en
 * este archivo ni en ningún otro del frontend.
 */
export const adminHttp = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api/admin",
  withCredentials: true,
  timeout: 8000,
});

adminHttp.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginCall = error.config?.url?.includes("/auth/login");
    const isMeCall = error.config?.url?.includes("/auth/me");

    // Un 401 en /auth/me es esperado cuando aún no hay sesión (lo maneja
    // RequireAuth/RootRedirect); no lo tratamos como "sesión expirada".
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
