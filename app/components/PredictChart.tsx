"use client";

import { Line } from '@ant-design/plots';
import { Card, Radio, Select, Space, Spin } from 'antd';
import { useEffect, useState } from 'react';
import axiosServices from '../utils/my-axios';
import MainLayout from './Layout';
import './PredictChart.scss';

interface GuessResult {
  top_1_number: number;
  top_2_number: number;
  top_3_number: number;
  top_4_number: number;
  top_5_number: number;
}

interface DrawResult {
  draw_time: number;
  full_number: string;
  draw_number: string;
}

interface PredictItem {
  _id: string;
  created_at: string;
  updated_at: string;
  guess_period: string;
  guess_time: number;
  guess_result: GuessResult | null;
  guess_type: 'ai_5_normal';
  ext_result: DrawResult[] | null;
  draw_status: 'created' | 'drawed' | 'executing' | 'finished' | 'failed';
  retry_count: number;
  is_success: boolean;
}

const PredictChart = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [winType, setWinType] = useState<'current' | 'any'>('current');
  const [chartData, setChartData] = useState<any[]>([]);

  // 检查当期是否中奖
  const checkCurrentPeriodWin = (record: PredictItem): boolean => {
    if (!record.guess_result || !record.ext_result || record.ext_result.length === 0) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    if (prediction === "暂无结果" || prediction.length === 0) {
      return false;
    }

    const firstDigitOfPrediction = prediction[0];
    const lastFourDigits = prediction.slice(1);

    // 只检查期号相同的那组开奖结果
    const matchedDrawResult = record.ext_result.find(drawResult => 
      drawResult.draw_number === record.guess_period
    );

    if (!matchedDrawResult) {
      return false;
    }

    const fullNumberDigits = matchedDrawResult.full_number.split('');
    const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
    const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit => 
      fullNumberDigits.includes(digit)
    );

    return isFirstDigitMatched && isAnyLastFourDigitsMatched;
  };

  // 检查三期内是否中奖
  const checkThreePeriodsWin = (record: PredictItem): boolean => {
    if (!record.guess_result || !record.ext_result || record.ext_result.length === 0) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    if (prediction === "暂无结果" || prediction.length === 0) {
      return false;
    }

    const firstDigitOfPrediction = prediction[0];
    const lastFourDigits = prediction.slice(1);

    return record.ext_result.some(drawResult => {
      const fullNumberDigits = drawResult.full_number.split('');
      const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
      const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit => 
        fullNumberDigits.includes(digit)
      );
      return isFirstDigitMatched && isAnyLastFourDigitsMatched;
    });
  };

  const formatGuessResult = (result: GuessResult | null): string => {
    if (!result) return "暂无结果";
    return `${result.top_1_number}${result.top_2_number}${result.top_3_number}${result.top_4_number}${result.top_5_number}`;
  };

  // 计算胜率
  const calculateWinRate = (items: PredictItem[]): number => {
    const validItems = items.filter(item => item.ext_result && item.ext_result.length > 0);
    if (validItems.length === 0) return 0;

    const winCount = validItems.filter(item => 
      winType === 'current' ? checkCurrentPeriodWin(item) : checkThreePeriodsWin(item)
    ).length;

    return (winCount / validItems.length) * 100;
  };

  // 处理数据并生成图表数据
  const processChartData = (items: PredictItem[]) => {
    // 按时间排序
    const sortedItems = [...items].sort((a, b) => a.guess_time - b.guess_time);
    
    // 生成图表数据
    const chartData = sortedItems.map((item, index) => {
      // 计算到当前项为止的所有数据的胜率
      const currentItems = sortedItems.slice(0, index + 1);
      const winRate = calculateWinRate(currentItems);
      
      return {
        time: new Date(item.guess_time * 1000).toLocaleString(),
        winRate: winRate.toFixed(2),
      };
    });

    setChartData(chartData);
  };

  const fetchData = async (size: number) => {
    setLoading(true);
    try {
      const response = await axiosServices.get('/client/lot/get_ai_guess_list', {
        params: {
          page: 1,
          page_size: size,
          guess_type:'ai_5_normal',
        }
      });
      setData(response.data.data.data);
      processChartData(response.data.data.data);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(pageSize);
  }, [pageSize]);

  useEffect(() => {
    processChartData(data);
  }, [winType]);

  const config = {
    data: chartData,
    xField: 'time',
    yField: 'winRate',
    smooth: true,
    xAxis: {
      type: 'time',
      title: {
        text: '预测时间',
      },
    },
    yAxis: {
      title: {
        text: '胜率(%)',
      },
      min: 0,
      max: 100,
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: '胜率', value: datum.winRate + '%' };
      },
    },
    point: {
      size: 5,
      shape: 'diamond',
      style: {
        fill: 'white',
        stroke: '#5B8FF9',
        lineWidth: 2,
      },
    },
  };

  return (
    <MainLayout>
      <div className="predict-chart-container">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space>
              <span>数据量：</span>
              <Select
                value={pageSize}
                onChange={setPageSize}
                options={[
                  { value: 100, label: '100条' },
                  { value: 200, label: '200条' },
                  { value: 500, label: '500条' },
                  { value: 1000, label: '1000条' },
                ]}
              />
              <span>胜率类型：</span>
              <Radio.Group value={winType} onChange={e => setWinType(e.target.value)}>
                <Radio.Button value="current">当期胜率</Radio.Button>
                <Radio.Button value="any">三期胜率</Radio.Button>
              </Radio.Group>
              <span>
                当前总胜率：
                {loading ? (
                  <Spin size="small" />
                ) : (
                  `${calculateWinRate(data).toFixed(2)}%`
                )}
              </span>
            </Space>
          </Card>
          
          <Card>
            <Spin spinning={loading}>
              <Line {...config} />
            </Spin>
          </Card>
        </Space>
      </div>
    </MainLayout>
  );
};

export default PredictChart; 