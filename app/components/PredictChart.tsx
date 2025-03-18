"use client";

import { Card, Select, Space, Spin } from "antd";
import ReactECharts from 'echarts-for-react';
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
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
  guess_type: string;
  ext_result: DrawResult[] | null;
  draw_status: "created" | "drawed" | "executing" | "finished" | "failed";
  retry_count: number;
  is_success: boolean;
}

const PredictChart = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<PredictItem[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [winType, setWinType] = useState<"current" | "two" | "any">("current");
  const [chartData, setChartData] = useState<any[]>([]);
  const [winLoseData, setWinLoseData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);
  const [guessType, setGuessType] = useState<string>("ai_5_normal");

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

  // 生成热力图数据
  const generateHeatmapData = (items: PredictItem[], currentWinType: "current" | "two" | "any") => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const periods = Array.from({ length: 12 }, (_, i) => i + 1);

    // 初始化数据
    const data: [number, number, number][] = [];

    items.forEach(item => {
      const date = new Date(item.guess_time * 1000);
      const hour = date.getHours();
      const minute = date.getMinutes();
      const period = Math.floor(minute / 5) + 1;

      let isWin = false;
      if (currentWinType === "current") {
        isWin = checkCurrentPeriodWin(item);
      } else if (currentWinType === "two") {
        isWin = checkTwoPeriodsWin(item);
      } else {
        isWin = checkThreePeriodsWin(item);
      }

      data.push([hour, period - 1, isWin ? 1 : 0]);
    });

    return data;
  };

  // 获取最近一周的数据
  const fetchWeeklyData = async () => {
    setLoading(true);
    try {
      // 计算最近7天的开始时间
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const params = {
        page: 1,
        page_size: 2016, // 直接获取2016条数据
        guess_type: guessType,
        start_time: Math.floor(startDate.getTime() / 1000),
        end_time: Math.floor(endDate.getTime() / 1000)
      };

      const response = await axiosServices.get(
          "/client/lot/get_ai_guess_list",
          { params }
      );

      const newData = response.data.data.data;
      setWeeklyData(newData);
      generateWeeklyChartData(newData);
    } catch (error) {
      console.error("获取周数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 生成最近一周每日胜率数据
  const generateWeeklyChartData = (items: PredictItem[]) => {
    // 获取最近7天的日期
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date);
    }

    // 按日期分组数据
    const dailyData = dates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(dateStr);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      // 根据日期筛选当天数据
      const dayItems = items.filter(item => {
        const itemDate = new Date(item.guess_time * 1000);
        return itemDate >= startOfDay && itemDate <= endOfDay;
      });

      // 按时间段分组
      const dayTimeItems = dayItems.filter(item => {
        const hour = new Date(item.guess_time * 1000).getHours();
        return hour >= 6 && hour < 18; // 6:00 - 18:00
      });

      const nightTimeItems = dayItems.filter(item => {
        const hour = new Date(item.guess_time * 1000).getHours();
        return hour < 6 || hour >= 18; // 18:00 - 6:00
      });

      // 计算不同时间段的胜率
      const allDayWinRate = calculateWinRate(dayItems, winType);
      const dayTimeWinRate = calculateWinRate(dayTimeItems, winType);
      const nightTimeWinRate = calculateWinRate(nightTimeItems, winType);

      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        allDay: {
          winRate: Number(allDayWinRate.toFixed(2)),
          count: dayItems.length
        },
        dayTime: {
          winRate: Number(dayTimeWinRate.toFixed(2)),
          count: dayTimeItems.length
        },
        nightTime: {
          winRate: Number(nightTimeWinRate.toFixed(2)),
          count: nightTimeItems.length
        }
      };
    });

    setWeeklyChartData(dailyData);
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

    // 生成热力图数据
    const heatmapData = generateHeatmapData(sortedItems, currentWinType);

    setChartData(chartData);
    setWinLoseData(winLoseData);
    setHeatmapData(heatmapData);
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
    if (weeklyData.length > 0) {
      generateWeeklyChartData(weeklyData);
    }
  };

  const handleGuessTypeChange = (value: string) => {
    setGuessType(value);
  };

  useEffect(() => {
    fetchWeeklyData();
  }, [guessType, winType]);

  useEffect(() => {
    processChartData(data, winType);
  }, [winType]);

  const weeklyOption = {
    title: {
      text: '最近一周每日胜率',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: function(params: any) {
        let result = params[0].name + '<br/>';
        params.forEach((param: any) => {
          const data = param.data;
          const color = param.color;
          const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
          if (param.seriesIndex === 0) {
            result += `${marker}全天: ${data}%（样本: ${param.data.count}）<br/>`;
          } else if (param.seriesIndex === 1) {
            result += `${marker}白天: ${data}%（样本: ${param.data.count}）<br/>`;
          } else if (param.seriesIndex === 2) {
            result += `${marker}晚上: ${data}%（样本: ${param.data.count}）<br/>`;
          }
        });
        return result;
      }
    },
    legend: {
      data: ['全天', '白天', '晚上'],
      top: '30px'
    },
    grid: {
      top: '80px',
      bottom: '10%',
      left: '10%',
      right: '10%'
    },
    xAxis: {
      type: 'category' as const,
      data: weeklyChartData.map(item => item.date),
      axisLabel: {
        rotate: 0
      }
    },
    yAxis: {
      type: 'value' as const,
      min: winType === "any" ? 50 : winType === "two" ? 40 : 0,
      max: 100,
      name: '胜率(%)',
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed' as const
        }
      }
    },
    series: [
      {
        name: '全天',
        type: 'bar' as const,
        data: weeklyChartData.map(item => ({
          value: item.allDay.winRate,
          count: item.allDay.count
        })),
        itemStyle: {
          color: '#2593fc'
        },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%'
        }
      },
      {
        name: '白天',
        type: 'bar' as const,
        data: weeklyChartData.map(item => ({
          value: item.dayTime.winRate,
          count: item.dayTime.count
        })),
        itemStyle: {
          color: '#52c41a'
        },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%'
        }
      },
      {
        name: '晚上',
        type: 'bar' as const,
        data: weeklyChartData.map(item => ({
          value: item.nightTime.winRate,
          count: item.nightTime.count
        })),
        itemStyle: {
          color: '#ff4d4f'
        },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%'
        }
      }
    ]
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
      min: winType === "any" ? 50 : winType === "two" ? 40 : 0,
      max: 100,
      name: '胜率(%)',
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed' as const
        }
      }
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
      },
      markLine: {
        silent: true,
        symbol: 'none',

        data: [
          {
            yAxis: 70,
            lineStyle: {
              color: '#ff4d4f',
              width: 2,
              type: 'solid' as const
            }
          }
        ]
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
      step: 'middle' as const,
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

  const heatmapOption = {
    title: {
      text: '开奖状态热力图',
      left: 'center'
    },
    tooltip: {
      position: 'top' as const,
      formatter: function (params: any) {
        return `时间: ${params.data[0]}时 第${params.data[1] + 1}期<br/>状态: ${params.data[2] ? '中奖' : '未中奖'}`;
      }
    },
    grid: {
      top: '60px',
      bottom: '10%',
      left: '10%',
      right: '10%'
    },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${i}时`),
      splitArea: {
        show: true
      }
    },
    yAxis: {
      type: 'category' as const,
      data: Array.from({ length: 12 }, (_, i) => `${i + 1}期`),
      splitArea: {
        show: true
      }
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: false,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#dcdcdc', '#52c41a']
      },
      textStyle: {
        color: '#333'
      }
    },
    series: [{
      name: '开奖状态',
      type: 'heatmap' as const,
      data: heatmapData,
      label: {
        show: false
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  return (
      <MainLayout>
        <div className="predict-chart-container">
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space>
              <span>预测策略：</span>
              <Select
                  value={guessType}
                  onChange={handleGuessTypeChange}
                  style={{ width: 150 }}
                  options={[
                    { value: "ai_5_normal", label: "AI-5" },
                    { value: "ai_5_plus", label: "AI-5 Plus" },
                    { value: "ai_5_gemini", label: "AI-5 Gemini" },
                    { value: "ai_5_gemini_plus", label: "AI-5 Gemini Plus" },
                  ]}
              />
            </Space>
            <PredictStats
                guess_type={guessType}
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

            <Card title="最近一周每日胜率">
              <Spin spinning={loading}>
                <ReactECharts
                    option={weeklyOption}
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

            <Card>
              <Spin spinning={loading}>
                <ReactECharts
                    option={heatmapOption}
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
