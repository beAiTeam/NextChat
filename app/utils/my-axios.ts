import axios, { AxiosRequestConfig } from 'axios';
// import { getAuthToken, removeAuthToken } from 'src/utils/token.utils.ts';
import toast from 'react-hot-toast';
import { MY_BASE_URL } from '../extra-constant';

// 获取cookie中的secret_key
const getSecretKey = () => {
  const cookies = document.cookie.split(';');
  const secretKeyCookie = cookies.find(cookie => cookie.trim().startsWith('secret_key='));
  return secretKeyCookie ? secretKeyCookie.split('=')[1].trim() : '';
};

const axiosServices = axios.create({
  baseURL: MY_BASE_URL,
});

// interceptor for http

axiosServices.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const headers = { ...config.headers };
    const secretKey = getSecretKey();
    headers.Authorization = secretKey ? secretKey : '';
    config.headers = headers;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

axiosServices.interceptors.response.use(
  (response) => {
    if (Number(response.data.code) !== 1) {
      if (response.data.msg) {
        toast.error(response.data.msg);
      }
      //抛出错误
      return Promise.reject(response);
    }
    console.log('resp', response.data);
    return response;
  },
  (error) => {
    console.log('error', error);

    if (error.response && error.response.status === 422) {
      toast.error('参数校验错误 请检查填写内容');
    }

    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // 检查是否是secret key验证失败的情况
      if (error.response.data?.detail?.msg === 'Could not validate credentials') {
        // 移除cookie
        document.cookie = 'secret_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // 跳转到secret页面
        window.location.href = '/secret';
        return Promise.reject(error);
      }

       
    }
 
    return Promise.reject(error);
  },
);

export default axiosServices;
