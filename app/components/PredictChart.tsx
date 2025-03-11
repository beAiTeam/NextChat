"use client";

import { Card, Space, Spin } from "antd";
import ReactECharts from 'echarts-for-react';
import { useState } from "react";
import {
  checkCurrentPeriodMatch,
  checkThreePeriodsMatch,
  checkTwoPeriodsMatch,
  DrawResult,
  formatGuessResult,
  GuessResult,
} from "../utils/predict-utils";
import MainLayout from "./Layout";
import "./PredictChart.scss";
import PredictStats from "./PredictStats";

interface PredictItem {
  _id: string;
  created_at: string;
  updated_at: string;
  guess_period: string;
  guess_time: number;
  guess_result: GuessResult | null;
  guess_type: "ai_5_normal";
  ext_result: DrawResult[] | null;
  draw_status: "created" | "drawed" | "executing" | "finished" | "failed";
  retry_count: number;
  is_success: boolean;
}

const PredictChart = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [winType, setWinType] = useState<"current" | "two" | "any">("current");
  const [chartData, setChartData] = useState<any[]>([]);
  const [winLoseData, setWinLoseData] = useState<any[]>([]);

  // 检查当期是否中奖
  const checkCurrentPeriodWin = (record: PredictItem): boolean => {
    if (
        !record.guess_result ||
        !record.ext_result ||
        record.ext_result.length === 0
    ) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    return checkCurrentPeriodMatch(
        prediction,
        record.ext_result,
        record.guess_period,
    );
  };

  // 检查两期内是否中奖
  const checkTwoPeriodsWin = (record: PredictItem): boolean => {
    if (
        !record.guess_result ||
        !record.ext_result ||
        record.ext_result.length === 0
    ) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    return checkTwoPeriodsMatch(prediction, record.ext_result);
  };

  // 检查三期内是否中奖
  const checkThreePeriodsWin = (record: PredictItem): boolean => {
    if (
        !record.guess_result ||
        !record.ext_result ||
        record.ext_result.length === 0
    ) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    return checkThreePeriodsMatch(prediction, record.ext_result);
  };

  // 处理数据并生成图表数据
  const processChartData = (items: PredictItem[], currentWinType: "current" | "two" | "any") => {
    // 按时间排序
    const sortedItems = [...items].sort((a, b) => a.guess_time - b.guess_time);

    // 生成胜率图表数据
    const chartData = sortedItems.map((item, index) => {
      // 计算到当前项为止的所有数据的胜率
      const currentItems = sortedItems.slice(0, index + 1);
      const winRate = calculateWinRate(currentItems, currentWinType);

      const date = new Date(item.guess_time * 1000);
      const today = new Date();
      let timeStr;

      if (date.toDateString() === today.toDateString()) {
        timeStr = date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } else {
        timeStr = date.toLocaleString("zh-CN");
      }

      return {
        time: timeStr,
        winRate: Number(winRate.toFixed(2)),
      };
    });

    // 生成中奖/未中奖图表数据
    const winLoseData = sortedItems.map((item) => {
      const date = new Date(item.guess_time * 1000);
      const today = new Date();
      let timeStr;

      if (date.toDateString() === today.toDateString()) {
        timeStr = date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } else {
        timeStr = date.toLocaleString("zh-CN");
      }

      let isWin = false;
      if (currentWinType === "current") {
        isWin = checkCurrentPeriodWin(item);
      } else if (currentWinType === "two") {
        isWin = checkTwoPeriodsWin(item);
      } else {
        isWin = checkThreePeriodsWin(item);
      }

      return {
        time: timeStr,
        value: isWin ? 1 : -1,
      };
    });

    setChartData(chartData);
    setWinLoseData(winLoseData);
  };

  // 计算胜率
  const calculateWinRate = (items: PredictItem[], currentWinType: "current" | "two" | "any"): number => {
    const validItems = items.filter(
      (item) => item.ext_result && item.ext_result.length > 0,
    );
    if (validItems.length === 0) return 0;

    const winCount = validItems.filter((item) => {
      if (currentWinType === "current") return checkCurrentPeriodWin(item);
      if (currentWinType === "two") return checkTwoPeriodsWin(item);
      return checkThreePeriodsWin(item);
    }).length;

    return (winCount / validItems.length) * 100;
  };

  const handleDataChange = (newData: PredictItem[]) => {
    setData(newData);
    processChartData(newData, winType);
  };

  const handleWinTypeChange = (newWinType: "current" | "two" | "any") => {
    setWinType(newWinType);
    processChartData(data, newWinType);
  };

  const winRateOption = {
    title: {
      text: '胜率趋势',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: '{b}<br/>胜率: {c}%'
    },
    xAxis: {
      type: 'category' as const,
      data: chartData.map(item => item.time),
      axisLabel: {
        rotate: 45,
        interval: Math.floor(chartData.length / 10)
      }
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      name: '胜率(%)'
    },
    series: [{
      data: chartData.map(item => item.winRate),
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: {
        color: '#2593fc'
      },
      lineStyle: {
        width: 2
      }
    }]
  };

  const winLoseOption = {
    title: {
      text: '中奖状态',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: function(params: any) {
        const value = params[0].value;
        return `${params[0].name}<br/>${value > 0 ? '中奖' : '未中奖'}`;
      }
    },
    xAxis: {
      type: 'category' as const,
      data: winLoseData.map(item => item.time),
      axisLabel: {
        rotate: 45,
        interval: Math.floor(winLoseData.length / 10)
      }
    },
    yAxis: {
      type: 'value' as const,
      min: -2,
      max: 2,
      interval: 1,
      axisLabel: {
        formatter: function(value: number) {
          if (value === 1) return '中奖';
          if (value === -1) return '未中奖';
          return '';
        }
      }
    },
    series: [{
      data: winLoseData.map(item => item.value),
      type: 'line' as const,
      step: 'middle',
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: {
        color: function(params: any) {
          return params.data > 0 ? '#52c41a' : '#ff4d4f';
        }
      },
      lineStyle: {
        width: 2
      }
    }],
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    }
  };

  return (
    <MainLayout>
      <div className="predict-chart-container">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <PredictStats 
            onDataChange={handleDataChange}
            onWinTypeChange={handleWinTypeChange}
            defaultWinType={winType}
          />

          <Card>
            <Spin spinning={loading}>
              <ReactECharts
                option={winRateOption}
                style={{ height: '400px' }}
                notMerge={true}
                opts={{ renderer: 'svg' }}
              />
            </Spin>
          </Card>

          <Card>
            <Spin spinning={loading}>
              <ReactECharts
                option={winLoseOption}
                style={{ height: '400px' }}
                notMerge={true}
                opts={{ renderer: 'svg' }}
              />
            </Spin>
          </Card>
        </Space>
      </div>
    </MainLayout>
  );
};

export default PredictChart;
