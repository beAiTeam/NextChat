'use client';
import { Card, Radio, Space, Switch, Typography } from 'antd';
import { useEffect, useState } from 'react';
import MainLayout from '../components/Layout';
import { safeLocalStorage } from '../utils';

const { Title } = Typography;

const ConfigPage = () => {
  const [matchCondition, setMatchCondition] = useState<string>('option2');
  const [continueBetting, setContinueBetting] = useState<boolean>(false);
  const localStorage = safeLocalStorage();

  useEffect(() => {
    // 从本地存储加载配置
    const savedMatchCondition = localStorage.getItem('matchConditionConfig');
    if (savedMatchCondition) {
      setMatchCondition(savedMatchCondition);
    }
    
    // 加载中奖后继续投注配置
    const savedContinueBetting = localStorage.getItem('continueBettingConfig');
    if (savedContinueBetting) {
      setContinueBetting(savedContinueBetting === 'true');
    }
  }, []);

  const handleMatchConditionChange = (e: any) => {
    const value = e.target.value;
    setMatchCondition(value);
    localStorage.setItem('matchConditionConfig', value);
  };
  
  const handleContinueBettingChange = (checked: boolean) => {
    setContinueBetting(checked);
    localStorage.setItem('continueBettingConfig', String(checked));
  };

  return (
   <MainLayout>
     <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>系统配置</Title>
      
      <Card title="中奖判断条件" style={{ marginBottom: '20px' }}>
        <Space direction="vertical">
          <Typography.Text>设置判断中奖的条件：</Typography.Text>
          <Radio.Group value={matchCondition} onChange={handleMatchConditionChange}>
            <Space direction="vertical">
              <Radio value="option1">选项1: 只检查第一位数字是否匹配</Radio>
              <Radio value="option2">选项2: 需要满足第一位数字以及后续任一位数字</Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Card>
      
      <Card title="投注策略配置" style={{ marginBottom: '20px' }}>
        <Space direction="vertical">
          <Space align="center">
            <Typography.Text>中奖后是否继续投注：</Typography.Text>
            <Switch 
              checked={continueBetting} 
              onChange={handleContinueBettingChange}
              checkedChildren="是" 
              unCheckedChildren="否" 
            />
          </Space>
          <Typography.Text type="secondary">
            {continueBetting ? 
              '即使已中奖，仍会继续在后续期数投注' : 
              '中奖后将不再继续投注后续期数'}
          </Typography.Text>
        </Space>
      </Card>
    </div>
   </MainLayout>
  );
};

export default ConfigPage; 