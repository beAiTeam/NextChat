"use client";

import { useState } from 'react';
import { Input, Button, Card } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

const SecretPage = () => {
  const [secretKey, setSecretKey] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async () => {
    if (!secretKey.trim()) {
      toast.error('请输入密钥');
      return;
    }
    
    // 设置 cookie
    document.cookie = `secret_key=${secretKey}; path=/`;
    
    // 从 URL 参数获取返回路径
    const returnPath = searchParams.get('from') || '/';
    console.log('准备跳转到:', returnPath);
    
    try {
      await router.push(returnPath);
      console.log('跳转完成');
    } catch (error) {
      console.error('路由跳转失败:', error);
      toast.error('页面跳转失败，请重试');
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center', 
    }}>
      <Card title="请输入访问密钥" style={{ width: 400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input.Password
            placeholder="请输入密钥"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            onPressEnter={handleSubmit}
          />
          <Button type="primary" onClick={handleSubmit} block>
            确认
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SecretPage; 