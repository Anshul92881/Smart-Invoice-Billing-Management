import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

//  REQUEST INTERCEPTOR

api.interceptors.request.use(
  (config) => {
    const path = window.location.pathname;

    const token = path.startsWith("/kyc-verification")
      ? localStorage.getItem("kyc_token")
      : localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

//  RESPONSE INTERCEPTOR

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;
    const responseData = error.response?.data;

    /* Force logout when the user, company or Company Admin has been deactivated.*/
    if (responseData?.force_logout === true) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("kyc_token");
      localStorage.removeItem("pending_company_id");

      window.location.replace("/");

      return Promise.reject(error);
    }

    if (status === 403 && responseData?.kyc_required === true) {
      window.dispatchEvent(
        new CustomEvent("kycRequired", {
          detail: {
            message:
              responseData?.message ||
              "Your KYC is pending. Complete KYC to use this feature.",
          },
        }),
      );
    }

    return Promise.reject(error);
  },
);

export default api;
