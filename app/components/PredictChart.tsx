"use client";

import { Input, Modal, Select, Space } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import {
  BetConfig,
  calculateBalanceChange,
  checkCurrentPeriodMatch,
  checkThreePeriodsMatch,
  checkTwoPeriodsMatch,
  DrawResult,
  formatGuessResult,
  GuessResult
} from "../utils/predict-utils";
import {
  BalanceChart,
  HeatmapChart,
  PredictDetailsTable,
  WeeklyChart,
  WinLoseChart,
  WinRateChart
} from "./charts";
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
  const [betConfig, setBetConfig] = useState<BetConfig>(() => {
    try {
      const savedConfig = localStorage.getItem('betConfig');
      return savedConfig ? JSON.parse(savedConfig) : { x: 1, y: 2, z: 4 };
    } catch {
      return { x: 1, y: 2, z: 4 };
    }
  });
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [detailsData, setDetailsData] = useState<any[]>([]);

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

    // 生成余额变化数据
    const balanceData = sortedItems.map((item, index) => {
      const currentItems = sortedItems.slice(0, index + 1);
      let totalBalance = 0;
      
      currentItems.forEach(currentItem => {
        const balanceResult = calculateBalanceChange(
          formatGuessResult(currentItem.guess_result),
          currentItem.ext_result,
          betConfig
        );
        totalBalance += balanceResult.balance;
      });

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
        balance: Math.floor(totalBalance * 100) / 100, // 保留两位小数
      };
    });

    setBalanceData(balanceData);
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

  // 生成详细的盈亏数据
  const generateDetailsData = (items: PredictItem[]) => {
    let runningBalance = 0; // 记录累计余额
    
    return items.map((item, index) => {
      const balanceResult = calculateBalanceChange(
        formatGuessResult(item.guess_result),
        item.ext_result,
        betConfig
      );

      // 更新当前余额
      runningBalance += balanceResult.balance;

      const prediction = formatGuessResult(item.guess_result);
      const date = new Date(item.guess_time * 1000);

      // 处理开奖号码和中奖号码的高亮
      const drawNumbersWithHighlight = item.ext_result?.map(result => {
        const numbers = result.full_number.split('');
        const firstDigitOfPrediction = prediction[0];
        const lastFourDigits = prediction.slice(1).split('');
        
        // 检查第一位是否匹配
        const isFirstDigitMatched = numbers.includes(firstDigitOfPrediction);
        // 创建一个新的数组，排除掉第一位匹配的数字
        const remainingDigits = numbers.filter(digit => digit !== firstDigitOfPrediction);
        // 找到匹配的后四位数字
        const matchedLastDigits = lastFourDigits.filter(digit => remainingDigits.includes(digit));

        // 为每个数字添加高亮标记
        const highlightedNumbers = numbers.map(num => {
          if (num === firstDigitOfPrediction && isFirstDigitMatched) {
            return { number: num, highlight: true };
          }
          if (matchedLastDigits.includes(num)) {
            return { number: num, highlight: true };
          }
          return { number: num, highlight: false };
        });

        return highlightedNumbers;
      }) || [];

      return {
        key: item._id,
        time: date.toLocaleString("zh-CN"),
        period: item.guess_period,
        prediction: prediction,
        drawNumbers: drawNumbersWithHighlight,
        details: balanceResult.details,
        balance: balanceResult.balance,
        currentBalance: Math.floor(runningBalance * 100) / 100, // 保留两位小数
      };
    });
  };

  // 处理查看详情按钮点击
  const handleViewDetails = () => {
    const sortedItems = [...data].sort((a, b) => a.guess_time - b.guess_time);
    setDetailsData(generateDetailsData(sortedItems));
    setIsDetailsVisible(true);
  };

  // 处理倍投配置变化
  const handleBetConfigChange = (key: 'x' | 'y' | 'z', value: string) => {
    // 确保输入为正数，且不超过100
    const numValue = Math.min(Math.max(Number(value) || 0, 0), 100);
    const newConfig = { ...betConfig, [key]: numValue };
    setBetConfig(newConfig);
    try {
      localStorage.setItem('betConfig', JSON.stringify(newConfig));
    } catch (error) {
      console.error('Failed to save bet config:', error);
    }
    // 不需要重新获取数据，只需要重新计算余额数据
    processChartData(data, winType);
  };

  useEffect(() => {
    fetchWeeklyData();
  }, [guessType, winType]);

  useEffect(() => {
    processChartData(data, winType);
  }, [winType, betConfig, data]);

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
              <span>倍投配置：</span>
              <Space>
                X:
                <Input
                  type="number"
                  value={betConfig.x}
                  onChange={(e) => handleBetConfigChange('x', e.target.value)}
                  style={{ width: 180 }}
                  min={0}
                  max={1000}
                />
                Y:
                <Input
                  type="number"
                  value={betConfig.y}
                  onChange={(e) => handleBetConfigChange('y', e.target.value)}
                  style={{ width: 180 }}
                  min={0}
                  max={1000}
                />
                Z:
                <Input
                  type="number"
                  value={betConfig.z}
                  onChange={(e) => handleBetConfigChange('z', e.target.value)}
                  style={{ width: 180 }}
                  min={0}
                  max={1000}
                />
              </Space>
            </Space>
            <PredictStats
                guess_type={guessType}
                onDataChange={handleDataChange}
                onWinTypeChange={handleWinTypeChange}
                defaultWinType={winType}
            />

            <BalanceChart 
              balanceData={balanceData}
              loading={loading}
              onViewDetails={handleViewDetails}
            />
            
            <WinRateChart 
              chartData={chartData}
              loading={loading}
              winType={winType}
            />
            
            <WeeklyChart 
              weeklyChartData={weeklyChartData}
              loading={loading}
              winType={winType}
            />
            
            <WinLoseChart 
              winLoseData={winLoseData}
              loading={loading}
            />
            
            <HeatmapChart 
              heatmapData={heatmapData}
              loading={loading}
            />

            <Modal
              title="盈亏详情"
              open={isDetailsVisible}
              onCancel={() => setIsDetailsVisible(false)}
              width={1200}
              footer={null}
            >
              <PredictDetailsTable detailsData={detailsData} />
            </Modal>
          </Space>
        </div>
      </MainLayout>
  );
};

export default PredictChart;
