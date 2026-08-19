import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import authService, { LoginPayload, RegisterPayload } from '@/services/auth.service';
import useAuthStore from '@/stores/authStore';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@/types';

export const useLogin = () => {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginPayload) => authService.login(data),
    onSuccess: (res) => {
      const { user } = res.data.data;
      setAuth(user);
      toast.success('Đăng nhập thành công!');
      router.push('/');
    },
    onError: (err: AxiosError<ApiResponse<null>>) => {
      toast.error(err.response?.data?.message ?? 'Đăng nhập thất bại');
    },
  });
};

export const useRegister = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: (data: RegisterPayload) => authService.register(data),
    onSuccess: () => {
      toast.success('Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.');
      router.push('/login');
    },
    onError: (err: AxiosError<ApiResponse<null>>) => {
      toast.error(err.response?.data?.message ?? 'Đăng ký thất bại');
    },
  });
};

export const useLogout = () => {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      clearAuth();
      router.push('/login');
    },
  });
};

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onSuccess: () => toast.success('Link đặt lại mật khẩu đã được gửi đến email của bạn.'),
    onError: (err: AxiosError<ApiResponse<null>>) => toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

export const useResetPassword = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authService.resetPassword(token, password),
    onSuccess: () => {
      toast.success('Mật khẩu đã được đặt lại thành công!');
      router.push('/login');
    },
    onError: (err: AxiosError<ApiResponse<null>>) => toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });
};
