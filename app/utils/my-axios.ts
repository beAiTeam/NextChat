import axios from 'axios';
// import { getAuthToken, removeAuthToken } from 'src/utils/token.utils.ts';
import toast from 'react-hot-toast';
import { MY_BASE_URL } from '../extra-constant';

const axiosServices = axios.create({
  baseURL: MY_BASE_URL,
});

// interceptor for http

axiosServices.interceptors.request.use(
  (config) => {
    // const token = getAuthToken();
    config.headers = {
      ...config.headers,
      // Authorization: `${token ? token : ''}`,
    };
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

    if (
      (error.response && error.response.status === 401) ||
      (error.response && error.response.status === 403)
    ) {
      // toast.error('登录失效,请重新登录');
      // removeAuthToken();
      // 有public的接口，可以先考虑直接刷新页面 后续根据优化再跳转login等
      console.log('window.location.pathname', window.location.pathname);
      // 判断当前路径决定是否跳转登录页
      if (window.location.pathname.startsWith('/home/tools')) {
        window.location.reload();
      } else {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);

export default axiosServices;
