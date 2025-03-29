"use client";

import { Button, Card, DatePicker, Input, Radio, Space, Table } from "antd";
import { Dayjs } from "dayjs";
import ReactECharts from 'echarts-for-react';
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { LotAiGuessType } from "../types/ai";
import { safeLocalStorage } from "../utils";
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
import MainLayout from "./Layout";

const { RangePicker } = DatePicker;

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

interface ModelData {
  modelType: LotAiGuessType;
  data: PredictItem[];
  baseData: PredictItem[];
  balanceData: Array<{ time: string; balance: number }>;
  winRateData: Array<{ time: string; guess_time: number; winRate: number }>;
}

// 添加图表数据接口
interface ChartData {
  timeArray: string[];
  balanceChart: {
    series: Array<{
      name: string;
      data: (number | null)[];
      color: string;
    }>;
  };
  winRateChart: {
    series: Array<{
      name: string;
      data: (number | null)[];
      color: string;
    }>;
    yAxisMin: number;
    yAxisMax: number;
  };
  bestBalanceChart: {
    timeArray: string[];
    data: Array<{
      time: string;
      balance: number;
      model: string;
      isChangePoint: boolean;
    }>;
    yAxisMin: number;
    yAxisMax: number;
  };
  bestWinRateChart: {
    timeArray: string[];
    data: Array<{
      time: string;
      winRate: number;
      model: string;
      isChangePoint: boolean;
    }>;
    yAxisMin: number;
    yAxisMax: number;
  };
}

export const PredictCompare = () => {
  const localStorage = safeLocalStorage();
  const hasLoadedFromStorage = useRef(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLimit, setDataLimit] = useState(50);
  const [baseDataLimit, setBaseDataLimit] = useState(50);
  const [loadMoreCount, setLoadMoreCount] = useState(0);
  const [modelsData, setModelsData] = useState<ModelData[]>([]);
  const [winType, setWinType] = useState<"current" | "two" | "any">("current");
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [selectedModelData, setSelectedModelData] = useState<ModelData | null>(null);
  const [betConfig, setBetConfig] = useState<BetConfig>(() => {
    try {
      const savedConfig = localStorage.getItem("betConfig");
      return savedConfig ? JSON.parse(savedConfig) : { x: 1, y: 2, z: 4 };
    } catch {
      return { x: 1, y: 2, z: 4 };
    }
  });
  const [chartData, setChartData] = useState<ChartData | null>(null);

  // 生成颜色函数
  const generateColor = (index: number) => {
    const colors = [
      '#2593fc', '#52c41a', '#ff4d4f', '#faad14', '#722ed1', '#13c2c2',
      '#eb2f96', '#1890ff', '#fa8c16', '#a0d911', '#9254de', '#36cfc9'
    ];
    return colors[index % colors.length];
  };

  // 从localStorage读取保存的设置
  useEffect(() => {
    if (hasLoadedFromStorage.current) return;
    
    const savedDataLimit = localStorage.getItem("predict_data_limit");
    const savedWinType = localStorage.getItem("predict_win_type");
    const savedBaseDataLimit = localStorage.getItem("predict_base_data_limit");

    if (savedDataLimit) {
      setDataLimit(parseInt(savedDataLimit));
    }
    if (savedWinType) {
      setWinType(savedWinType as "current" | "two" | "any");
    }
    
    hasLoadedFromStorage.current = true;
    setIsSettingsLoaded(true);
  }, []); // 只在组件挂载时读取一次

  // 当设置变化时保存到localStorage
  // useEffect(() => {
  //   localStorage.setItem("predict_data_limit", dataLimit.toString());
  // }, [dataLimit]);

  // useEffect(() => {
  //   localStorage.setItem("betConfig", JSON.stringify(betConfig));
  // }, [betConfig]);

  // 计算胜率
  const calculateWinRate = (items: PredictItem[], currentWinType: "current" | "two" | "any"): number => {
    const validItems = items.filter(
      (item) => item.ext_result && item.ext_result.length > 0
    );
    if (validItems.length === 0) return 0;

    const winCount = validItems.filter((item) => {
      const guessResult = formatGuessResult(item.guess_result);
      if (!guessResult || !item.ext_result) return false;

      if (currentWinType === "current") {
        return checkCurrentPeriodMatch(guessResult, item.ext_result, item.guess_period);
      } else if (currentWinType === "two") {
        return checkTwoPeriodsMatch(guessResult, item.ext_result);
      } else {
        return checkThreePeriodsMatch(guessResult, item.ext_result);
      }
    }).length;

    return (winCount / validItems.length) * 100;
  };

  // 生成胜率数据
  const generateWinRateData = (items: PredictItem[], baseItems: PredictItem[], currentWinType: "current" | "two" | "any") => {
    // 按时间排序并合并基底数据和展示数据
    const allItems = [...baseItems, ...items].sort((a, b) => a.guess_time - b.guess_time);
    
    // 只对展示数据的时间点生成胜率数据
    const winRateData = items.map(currentItem => {
      // 找到当前项在完整数据中的位置
      const currentIndex = allItems.findIndex(i => i.guess_time === currentItem.guess_time);
      if (currentIndex === -1) return null;
      
      // 计算滑动窗口的起始位置（包括当前位置）
      const windowStartIndex = Math.max(0, currentIndex - baseDataLimit + 1);
      // 获取窗口内的所有数据
      const windowItems = allItems.slice(windowStartIndex, currentIndex + 1);
      
      // 计算窗口内的胜率
      const validItems = windowItems.filter(
        (item) => item.ext_result && item.ext_result.length > 0
      );

      const winCount = validItems.filter((item) => {
        const guessResult = formatGuessResult(item.guess_result);
        if (!guessResult || !item.ext_result) return false;

        if (currentWinType === "current") {
          return checkCurrentPeriodMatch(guessResult, item.ext_result, item.guess_period);
        } else if (currentWinType === "two") {
          return checkTwoPeriodsMatch(guessResult, item.ext_result);
        } else {
          return checkThreePeriodsMatch(guessResult, item.ext_result);
        }
      }).length;

      const winRate = validItems.length > 0 ? (winCount / validItems.length) * 100 : 0;

      const date = new Date(currentItem.guess_time * 1000);
      return {
        time: date.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }),
        guess_time: currentItem.guess_time,
        winRate: Number(winRate.toFixed(2))
      };
    }).filter(item => item !== null) as Array<{ time: string; guess_time: number; winRate: number }>;

    // 按照guess_time排序
    return winRateData.sort((a, b) => a.guess_time - b.guess_time);
  };

  // 处理胜率类型变化
  const handleWinTypeChange = (newWinType: "current" | "two" | "any") => {
    setWinType(newWinType);
    // if (modelsData.length > 0) {
    //   const updatedModelsData = modelsData.map(modelData => ({
    //     ...modelData,
    //     winRateData: generateWinRateData(modelData.data, modelData.baseData, newWinType)
    //   }));
    //   setModelsData(updatedModelsData);
    // }
  };

  // 生成余额变化数据
  const generateBalanceData = (items: PredictItem[]) => {
    const sortedItems = [...items].sort((a, b) => a.guess_time - b.guess_time);
    return sortedItems.map((item, index) => {
      // 计算到当前项为止的所有数据
      let currentItems = sortedItems.slice(0, index + 1);

      let totalBalance = 0;
      currentItems.forEach((currentItem) => {
        const balanceResult = calculateBalanceChange(
          formatGuessResult(currentItem.guess_result),
          currentItem.ext_result,
          betConfig,
          winType
        );
        totalBalance += balanceResult.balance;
      });

      const date = new Date(item.guess_time * 1000);
      return {
        time: date.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }),
        balance: Math.floor(totalBalance * 100) / 100,
      };
    });
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (range: [Dayjs | null, Dayjs | null]) => {
    setTimeRange(range);
    if (range[0] && range[1]) {
      setDataLimit(2000); // 当选择时间范围时，自动设置为2000条数据
    }
  };

  // 处理倍投配置变化
  const handleBetConfigChange = (key: "x" | "y" | "z", value: string) => {
    const numValue = Math.min(Math.max(Number(value) || 0, 0), 100);
    const newConfig = { ...betConfig, [key]: numValue };
    setBetConfig(newConfig);
    try {
      localStorage.setItem("betConfig", JSON.stringify(newConfig));
    } catch (error) {
      console.error("Failed to save bet config:", error);
    }
    // 重新计算所有模型的余额数据
    // if (modelsData.length > 0) {
    //   const updatedModelsData = modelsData.map(modelData => ({
    //     ...modelData,
    //     balanceData: generateBalanceData(modelData.data)
    //   }));
    //   setModelsData(updatedModelsData);
    // }
  };

  // 获取模型数据
  const fetchModelData = async (modelType: LotAiGuessType) => {
    try {
      const totalSize = dataLimit + baseDataLimit;
      const params: any = {
        page: 1,
        page_size: totalSize,
        guess_type: modelType,
      };

      // 添加时间范围参数
      if (timeRange[0] && timeRange[1]) {
        params.start_time = Math.floor(timeRange[0].valueOf() / 1000);
        params.end_time = Math.floor(timeRange[1].valueOf() / 1000);
      }

      const response = await axiosServices.get("/client/lot/get_ai_guess_list", { params });

      const allData = response.data.data.data;
      // 由于接口返回的是倒序，我们需要先反转数据
      const sortedData = [...allData].reverse();
      const displayData = sortedData.slice(baseDataLimit, totalSize);
      const baseData = sortedData.slice(0, baseDataLimit);

      return {
        modelType,
        data: displayData,
        baseData: baseData,
        balanceData: generateBalanceData(displayData),
        winRateData: generateWinRateData(displayData, baseData, winType)
      };
    } catch (error) {
      console.error(`获取模型 ${modelType} 数据失败:`, error);
      return null;
    }
  };

  // 处理分析数据
  const processChartData = (modelDataArray: ModelData[]): ChartData => {
    const allTimes = new Set<string>();
    let maxWinRate = 0;
    let minWinRate = 100;

    // 收集所有时间点
    modelDataArray.forEach(modelData => {
      modelData.winRateData.forEach(item => {
        allTimes.add(item.time);
      });
    });

    // 排序时间数组
    const timeArray = Array.from(allTimes).sort((a, b) => {
      const timeA = modelDataArray[0].data.find(item => {
        const date = new Date(item.guess_time * 1000);
        return date.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }) === a;
      })?.guess_time || 0;
      
      const timeB = modelDataArray[0].data.find(item => {
        const date = new Date(item.guess_time * 1000);
        return date.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }) === b;
      })?.guess_time || 0;
      
      return timeA - timeB;
    });

    // 处理余额图表数据
    const balanceChartSeries = modelDataArray.map((modelData, index) => ({
      name: modelData.modelType,
      data: timeArray.map(time => {
        const dataPoint = modelData.balanceData.find(item => item.time === time);
        return dataPoint ? dataPoint.balance : null;
      }),
      color: generateColor(index)
    }));

    // 处理胜率图表数据
    const winRateChartSeries = modelDataArray.map((modelData, index) => {
      const data = timeArray.map(time => {
        const dataPoint = modelData.winRateData.find(item => item.time === time);
        if (dataPoint) {
          if (dataPoint.winRate > maxWinRate) maxWinRate = dataPoint.winRate;
          if (dataPoint.winRate < minWinRate) minWinRate = dataPoint.winRate;
          return dataPoint.winRate;
        }
        return null;
      });
      return {
        name: modelData.modelType,
        data,
        color: generateColor(index)
      };
    });

    // 计算最佳胜率数据
    const bestRateData = timeArray.map((time, index) => {
      let bestRate = 0;
      let bestModel = '';
      
      modelDataArray.forEach(modelData => {
        const dataPoint = modelData.winRateData.find(item => item.time === time);
        if (dataPoint && dataPoint.winRate > bestRate) {
          bestRate = dataPoint.winRate;
          bestModel = modelData.modelType;
        }
      });

      // 检查是否是模型切换点
      let isChangePoint = false;
      if (index > 0) {
        const prevTime = timeArray[index - 1];
        let prevBestModel = '';
        let prevBestRate = 0;
        
        modelDataArray.forEach(modelData => {
          const prevDataPoint = modelData.winRateData.find(item => item.time === prevTime);
          if (prevDataPoint && prevDataPoint.winRate > prevBestRate) {
            prevBestRate = prevDataPoint.winRate;
            prevBestModel = modelData.modelType;
          }
        });

        isChangePoint = prevBestModel !== bestModel;
      }

      return {
        time,
        winRate: bestRate,
        model: bestModel,
        isChangePoint
      };
    });

    // 计算最佳余额数据
    let currentBalance = 0;
    let maxBalance = -Infinity;
    let minBalance = Infinity;
    const bestBalanceData = timeArray.map((time, index) => {
      let bestRate = 0;
      let bestModel = '';
      let bestModelData: ModelData | null = null;
      let bestDataIndex = -1;
      
      // 找出当前时间点胜率最高的模型
      for (const modelData of modelDataArray) {
        const winRatePoint = modelData.winRateData[index];
        if (winRatePoint && winRatePoint.winRate > bestRate) {
          bestRate = winRatePoint.winRate;
          bestModel = modelData.modelType;
          bestModelData = modelData;
          bestDataIndex = index;
        }
      }

      // 如果找到了最佳模型,计算余额变化
      if (bestModelData && bestDataIndex >= 0) {
        const predictItem = bestModelData.data[bestDataIndex];
        if (predictItem && predictItem.ext_result) {
          const guessResult = formatGuessResult(predictItem.guess_result);
          if (guessResult) {
            const balanceResult = calculateBalanceChange(
              guessResult,
              predictItem.ext_result,
              betConfig,
              winType
            );
            currentBalance += balanceResult.balance;
          }
        }
      }

      if (currentBalance > maxBalance) maxBalance = currentBalance;
      if (currentBalance < minBalance) minBalance = currentBalance;

      // 检查是否是模型切换点
      let isChangePoint = false;
      if (index > 0) {
        let prevBestModel = '';
        let prevBestRate = 0;
        
        for (const modelData of modelDataArray) {
          const prevWinRatePoint = modelData.winRateData[index - 1];
          if (prevWinRatePoint && prevWinRatePoint.winRate > prevBestRate) {
            prevBestRate = prevWinRatePoint.winRate;
            prevBestModel = modelData.modelType;
          }
        }

        isChangePoint = prevBestModel !== bestModel;
      }

      return {
        time,
        balance: currentBalance,
        model: bestModel,
        isChangePoint
      };
    });

    // 计算Y轴范围
    const winRateRange = maxWinRate - minWinRate;
    const balanceRange = maxBalance - minBalance;
    
    return {
      timeArray,
      balanceChart: {
        series: balanceChartSeries
      },
      winRateChart: {
        series: winRateChartSeries,
        yAxisMin: Math.max(0, minWinRate - 5),
        yAxisMax: Math.min(100, maxWinRate + 5)
      },
      bestBalanceChart: {
        timeArray,
        data: bestBalanceData,
        yAxisMin: minBalance - balanceRange * 0.05,
        yAxisMax: maxBalance + balanceRange * 0.05
      },
      bestWinRateChart: {
        timeArray,
        data: bestRateData,
        yAxisMin: Math.max(0, minWinRate - 5),
        yAxisMax: Math.min(100, maxWinRate + 5)
      }
    };
  };

  // 开始分析
  const handleAnalysis = async () => {
    setIsLoading(true);
    try {
      const modelTypes = [
        LotAiGuessType.Ai5_Normal,
        LotAiGuessType.Ai5_Plus,
        LotAiGuessType.Ai5_Gemini,
        LotAiGuessType.Ai5_Gemini_Plus
      ];
      
      const totalDataNeeded = dataLimit + baseDataLimit;
      
      const results = await Promise.all(
        modelTypes.map(async modelType => {
          try {
            const params: any = {
              page: 1,
              page_size: totalDataNeeded,
              guess_type: modelType,
            };

            if (timeRange[0] && timeRange[1]) {
              params.start_time = Math.floor(timeRange[0].valueOf() / 1000);
              params.end_time = Math.floor(timeRange[1].valueOf() / 1000);
            }

            const response = await axiosServices.get("/client/lot/get_ai_guess_list", { params });
            const allData = response.data.data.data;
            const sortedData = [...allData].reverse();
            const displayData = sortedData.slice(sortedData.length - dataLimit);
            const baseData = sortedData.slice(0, sortedData.length - dataLimit);

            return {
              modelType,
              data: displayData,
              baseData: baseData,
              balanceData: generateBalanceData(displayData),
              winRateData: generateWinRateData(displayData, baseData, winType)
            };
          } catch (error) {
            console.error(`获取模型 ${modelType} 数据失败:`, error);
            return null;
          }
        })
      );
      
      const validResults = results.filter((result): result is ModelData => result !== null);
      
      if (validResults.length === 0) {
        console.error('没有获取到任何有效的模型数据');
        return;
      }
      
      setModelsData(validResults);
      // 处理图表数据
      const newChartData = processChartData(validResults);
      setChartData(newChartData);
    } catch (error) {
      console.error("分析失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理加载更多数据
  const handleLoadMore = async () => {
    if (loadMoreCount <= 0) {
      toast.error('请输入要加载的期数');
      return;
    }
    
    setIsLoading(true);
    try {
      const modelTypes = [
        LotAiGuessType.Ai5_Normal,
        LotAiGuessType.Ai5_Plus,
        LotAiGuessType.Ai5_Gemini,
        LotAiGuessType.Ai5_Gemini_Plus
      ];
      
      const newDataLimit = dataLimit + loadMoreCount;
      const totalDataNeeded = newDataLimit + baseDataLimit;
      
      const results = await Promise.all(
        modelTypes.map(async modelType => {
          try {
            const params: any = {
              page: 1,
              page_size: totalDataNeeded,
              guess_type: modelType,
            };

            if (timeRange[0] && timeRange[1]) {
              params.start_time = Math.floor(timeRange[0].valueOf() / 1000);
              params.end_time = Math.floor(timeRange[1].valueOf() / 1000);
            }

            const response = await axiosServices.get("/client/lot/get_ai_guess_list", { params });
            const allData = response.data.data.data;
            const sortedData = [...allData].reverse();
            const displayData = sortedData.slice(sortedData.length - dataLimit);
            const baseData = sortedData.slice(0, sortedData.length - dataLimit);

            return {
              modelType,
              data: displayData,
              baseData: baseData,
              balanceData: generateBalanceData(displayData),
              winRateData: generateWinRateData(displayData, baseData, winType)
            };
          } catch (error) {
            console.error(`获取模型 ${modelType} 数据失败:`, error);
            return null;
          }
        })
      );
      
      const validResults = results.filter((result): result is ModelData => result !== null);
      
      if (validResults.length === 0) {
        toast.error('没有获取到任何有效的模型数据');
        return;
      }
      
      setModelsData(validResults);
      // 处理图表数据
      const newChartData = processChartData(validResults);
      setChartData(newChartData);
      setDataLimit(newDataLimit);
      toast.success(`成功加载${loadMoreCount}期数据`);
    } catch (error) {
      console.error("加载更多数据失败:", error);
      toast.error('加载更多数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成胜率计算详情数据
  const generateWinRateDetails = (modelData: ModelData) => {
    const allItems = [...modelData.baseData, ...modelData.data].sort((a, b) => a.guess_time - b.guess_time);
    
    // 处理所有数据（包括基底数据和展示数据）
    return allItems.map((item, index) => {
      const itemsToCalculate = allItems.slice(0, index + 1);
      const validItems = itemsToCalculate.filter(
        (item) => item.ext_result && item.ext_result.length > 0
      );
      
      const winCount = validItems.filter((item) => {
        const guessResult = formatGuessResult(item.guess_result);
        if (!guessResult || !item.ext_result) return false;

        if (winType === "current") {
          return checkCurrentPeriodMatch(guessResult, item.ext_result, item.guess_period);
        } else if (winType === "two") {
          return checkTwoPeriodsMatch(guessResult, item.ext_result);
        } else {
          return checkThreePeriodsMatch(guessResult, item.ext_result);
        }
      }).length;

      const winRate = validItems.length > 0 ? (winCount / validItems.length) * 100 : 0;
      const date = new Date(item.guess_time * 1000);

      return {
        time: date.toLocaleString("zh-CN"),
        period: item.guess_period,
        winRate: Number(winRate.toFixed(2)),
        totalItems: itemsToCalculate.length,
        validItems: validItems.length,
        winCount: winCount,
        isBaseData: index < modelData.baseData.length,
        guessResult: formatGuessResult(item.guess_result),
        drawResult: item.ext_result && item.ext_result.length > 0 ? 
          item.ext_result.find(result => result.draw_number === item.guess_period)?.full_number : null,
        isWin: (() => {
          const guessResult = formatGuessResult(item.guess_result);
          if (!guessResult || !item.ext_result) return false;

          if (winType === "current") {
            return checkCurrentPeriodMatch(guessResult, item.ext_result, item.guess_period);
          } else if (winType === "two") {
            return checkTwoPeriodsMatch(guessResult, item.ext_result);
          } else {
            return checkThreePeriodsMatch(guessResult, item.ext_result);
          }
        })()
      };
    });
  };

  // 处理查看详情按钮点击
  const handleViewDetails = (modelData: ModelData) => {
    setSelectedModelData(modelData);
    setIsDetailsModalVisible(true);
  };

  // 渲染余额变化趋势图
  const renderBalanceChart = () => {
    if (!chartData) return {};

    return {
      title: {
        text: '余额变化趋势对比',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: function(params: any) {
          if (!Array.isArray(params)) {
            return '';
          }
          let result = params[0].name + '<br/>';
          params.forEach((param: any) => {
            const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`;
            const value = param.value === null ? '暂无数据' : param.value.toFixed(2);
            result += `${marker}${param.seriesName}: ${value}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: chartData.balanceChart.series.map(s => s.name),
        top: 30,
        type: 'scroll' as const,
        width: '80%'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 100,
        containLabel: true
      },
      xAxis: {
        type: 'category' as const,
        data: chartData.timeArray,
        axisLabel: {
          rotate: 45,
          interval: Math.floor(chartData.timeArray.length / 10)
        }
      },
      yAxis: {
        type: 'value' as const,
        name: '余额'
      },
      series: chartData.balanceChart.series.map(series => ({
        name: series.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'lttb' as const,
        data: series.data,
        itemStyle: {
          color: series.color
        },
        lineStyle: {
          width: 2
        }
      }))
    };
  };

  // 渲染胜率趋势图
  const getWinRateChartOption = () => {
    if (!chartData) return {};

    return {
      title: {
        text: '胜率趋势对比',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: function(params: any) {
          if (!Array.isArray(params)) {
            return '';
          }
          let result = params[0].name + '<br/>';
          params.forEach((param: any) => {
            const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`;
            const value = param.value === null ? '暂无数据' : param.value.toFixed(2);
            result += `${marker}${param.seriesName}: ${value}%<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: chartData.winRateChart.series.map(s => s.name),
        top: 30,
        type: 'scroll' as const,
        width: '80%'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 100,
        containLabel: true
      },
      xAxis: {
        type: 'category' as const,
        data: chartData.timeArray,
        axisLabel: {
          rotate: 45,
          interval: Math.floor(chartData.timeArray.length / 10)
        }
      },
      yAxis: {
        type: 'value' as const,
        name: '胜率(%)',
        min: chartData.winRateChart.yAxisMin,
        max: chartData.winRateChart.yAxisMax
      },
      series: chartData.winRateChart.series.map(series => ({
        name: series.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'lttb' as const,
        data: series.data,
        itemStyle: {
          color: series.color
        },
        lineStyle: {
          width: 2
        }
      }))
    };
  };

  // 生成最佳余额图配置
  const getBestBalanceChartOption = () => {
    if (!chartData) return {};

    return {
      title: {
        text: '最佳胜率模型对应余额趋势',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: function(params: any) {
          if (!Array.isArray(params)) return '';
          const dataPoint = chartData.bestBalanceChart.data.find(d => d.time === params[0].name);
          if (!dataPoint) return '';
          
          return `${params[0].name}<br/>
                  最佳模型: ${dataPoint.model}<br/>
                  余额: ${dataPoint.balance.toFixed(2)}
                  ${dataPoint.isChangePoint ? '<br/><span style="color: #ff4d4f">模型切换点</span>' : ''}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 100,
        containLabel: true
      },
      xAxis: {
        type: 'category' as const,
        data: chartData.bestBalanceChart.timeArray,
        axisLabel: {
          rotate: 45,
          interval: Math.floor(chartData.bestBalanceChart.timeArray.length / 10)
        }
      },
      yAxis: {
        type: 'value' as const,
        name: '余额',
        min: chartData.bestBalanceChart.yAxisMin,
        max: chartData.bestBalanceChart.yAxisMax
      },
      series: [
        {
          name: '最佳余额',
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: (val: any, params: any) => {
            return chartData.bestBalanceChart.data[params.dataIndex].isChangePoint ? 10 : 6;
          },
          data: chartData.bestBalanceChart.data.map(item => ({
            value: item.balance,
            itemStyle: {
              color: item.isChangePoint ? '#ff4d4f' : '#1890ff'
            }
          })),
          lineStyle: {
            width: 2,
            color: '#1890ff'
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 8,
            data: chartData.bestBalanceChart.data
              .filter(item => item.isChangePoint)
              .map(item => ({
                name: '切换点',
                coord: [item.time, item.balance],
                itemStyle: {
                  color: '#ff4d4f'
                }
              }))
          }
        }
      ]
    };
  };

  // 生成最佳胜率图配置
  const getBestWinRateChartOption = () => {
    if (!chartData) return {};

    return {
      title: {
        text: '最佳胜率趋势',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: function(params: any) {
          if (!Array.isArray(params)) return '';
          const dataPoint = chartData.bestWinRateChart.data.find(d => d.time === params[0].name);
          if (!dataPoint) return '';
          
          return `${params[0].name}<br/>
                  最佳模型: ${dataPoint.model}<br/>
                  胜率: ${dataPoint.winRate.toFixed(2)}%
                  ${dataPoint.isChangePoint ? '<br/><span style="color: #ff4d4f">模型切换点</span>' : ''}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 100,
        containLabel: true
      },
      xAxis: {
        type: 'category' as const,
        data: chartData.bestWinRateChart.timeArray,
        axisLabel: {
          rotate: 45,
          interval: Math.floor(chartData.bestWinRateChart.timeArray.length / 10)
        }
      },
      yAxis: {
        type: 'value' as const,
        name: '胜率(%)',
        min: chartData.bestWinRateChart.yAxisMin,
        max: chartData.bestWinRateChart.yAxisMax
      },
      series: [
        {
          name: '最佳胜率',
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: (val: any, params: any) => {
            return chartData.bestWinRateChart.data[params.dataIndex].isChangePoint ? 10 : 6;
          },
          data: chartData.bestWinRateChart.data.map(item => ({
            value: item.winRate,
            itemStyle: {
              color: item.isChangePoint ? '#ff4d4f' : '#52c41a'
            }
          })),
          lineStyle: {
            width: 2,
            color: '#52c41a'
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 8,
            data: chartData.bestWinRateChart.data
              .filter(item => item.isChangePoint)
              .map(item => ({
                name: '切换点',
                coord: [item.time, item.winRate],
                itemStyle: {
                  color: '#ff4d4f'
                }
              }))
          }
        }
      ]
    };
  };

  // 生成表格数据
  const generateTableData = () => {
    if (!modelsData.length) return [];

    // 只获取非基底数据的期号
    const allPeriods = new Set<string>();
    modelsData.forEach(modelData => {
      modelData.data.forEach(item => {
        allPeriods.add(item.guess_period);
      });
    });

    // 按时间排序期号
    const sortedPeriods = Array.from(allPeriods).sort((a, b) => {
      const timeA = modelsData[0].data.find(item => item.guess_period === a)?.guess_time || 0;
      const timeB = modelsData[0].data.find(item => item.guess_period === b)?.guess_time || 0;
      return timeB - timeA;
    });

    // 生成表格数据
    return sortedPeriods.map(period => {
      const row: any = { key: period, period };
      
      // 获取开奖结果
      const firstModelData = modelsData[0].data.find(d => d.guess_period === period);
      if (firstModelData?.ext_result && firstModelData.ext_result.length > 0) {
        const matchedDrawResult = firstModelData.ext_result.find(drawResult => 
          drawResult.draw_number === period
        );
        row.drawResult = matchedDrawResult ? matchedDrawResult.full_number : null;
      }
      
      modelsData.forEach(modelData => {
        const item = modelData.data.find(d => d.guess_period === period);
        if (item) {
          const guessResult = formatGuessResult(item.guess_result);
          let isWin = false;
          if (guessResult && item.ext_result) {
            if (winType === "current") {
              isWin = checkCurrentPeriodMatch(guessResult, item.ext_result, item.guess_period);
            } else if (winType === "two") {
              isWin = checkTwoPeriodsMatch(guessResult, item.ext_result);
            } else {
              isWin = checkThreePeriodsMatch(guessResult, item.ext_result);
            }
          }
          row[modelData.modelType] = {
            prediction: guessResult,
            isWin: isWin
          };
        } else {
          row[modelData.modelType] = null;
        }
      });

      return row;
    });
  };

  // 生成表格列配置
  const generateTableColumns = () => {
    const baseColumns = [
      {
        title: '期号',
        dataIndex: 'period',
        key: 'period',
        fixed: 'left' as const,
        width: 180,
        render: (text: string, record: any) => (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(text);
              toast.success('已复制到剪贴板');
            }}
          >
            {text} {record.drawResult ? `(${record.drawResult})` : ''}
          </span>
        ),
      },
    ];

    const modelColumns = modelsData.map(modelData => ({
      title: modelData.modelType,
      dataIndex: modelData.modelType,
      key: modelData.modelType,
      width: 100,
      align: 'center' as const,
      render: (data: { prediction: string, isWin: boolean } | null) => {
        if (!data) return null;
        return (
          <div style={{
            padding: '4px',
            backgroundColor: data.isWin ? '#faad14' : 'transparent',
            border: '1px solid #d9d9d9',
            borderRadius: '2px'
          }}>
            {data.prediction}
          </div>
        );
      },
    }));

    return [...baseColumns, ...modelColumns];
  };

  return (
    <MainLayout>
      <div className="p-4">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title="数据配置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Input
                  addonBefore="数据量"
                  value={dataLimit}
                  onChange={(e) => setDataLimit(parseInt(e.target.value) || 0)}
                  style={{ width: 200 }}
                />
                <Input
                  addonBefore="基底数"
                  value={baseDataLimit}
                  onChange={(e) => setBaseDataLimit(parseInt(e.target.value) || 0)}
                  style={{ width: 200 }}
                />
              </Space>
              <Space>
                <Input
                  addonBefore="倍投X"
                  value={betConfig.x}
                  onChange={(e) => handleBetConfigChange("x", e.target.value)}
                  style={{ width: 150 }}
                />
                <Input
                  addonBefore="倍投Y"
                  value={betConfig.y}
                  onChange={(e) => handleBetConfigChange("y", e.target.value)}
                  style={{ width: 150 }}
                />
                <Input
                  addonBefore="倍投Z"
                  value={betConfig.z}
                  onChange={(e) => handleBetConfigChange("z", e.target.value)}
                  style={{ width: 150 }}
                />
              </Space>
              <Space>
                <Radio.Group value={winType} onChange={(e) => handleWinTypeChange(e.target.value)}>
                  <Radio.Button value="current">当期胜率</Radio.Button>
                  <Radio.Button value="two">两期胜率</Radio.Button>
                  <Radio.Button value="any">三期胜率</Radio.Button>
                </Radio.Group>
                <RangePicker
                  showTime
                  onChange={(dates) => handleTimeRangeChange(dates as [Dayjs, Dayjs])}
                />
              </Space>
              <Space>
                <Button type="primary" onClick={handleAnalysis} loading={isLoading}>
                  开始分析
                </Button>
              </Space>
            </Space>
          </Card>

          {modelsData && (
            <>
              <Card title="余额变化趋势">
                <ReactECharts option={renderBalanceChart()} style={{ height: '600px' }} />
                <div style={{ marginTop: '20px' }}>
                 
                </div>
              </Card>
              <Card 
                title="胜率趋势"
                extra={
                  <Space>
                    <Input
                      addonBefore="加载更多期数"
                      value={loadMoreCount}
                      onChange={(e) => setLoadMoreCount(parseInt(e.target.value) || 0)}
                      style={{ width: 200 }}
                    />
                    <Button type="primary" onClick={handleLoadMore} loading={isLoading}>
                      加载更多
                    </Button>
                  </Space>
                }
              >
                <ReactECharts option={getWinRateChartOption()} style={{ height: '600px' }} />
                
                <div style={{ marginTop: '20px' }}>
                <ReactECharts option={getBestBalanceChartOption()} style={{ height: '600px' }} />
                </div>
                <div style={{ marginTop: '20px' }}>
                  <ReactECharts option={getBestWinRateChartOption()} style={{ height: '600px' }} />
                </div>
                
              
              </Card>
              <Card title="预测结果对比">
                <Table
                  dataSource={generateTableData()}
                  columns={generateTableColumns()}
                  scroll={{ x: 'max-content', y: 800 }}
                  pagination={false}
                  className="predict-compare-table"
                />
              </Card>
            </>
          )}
        </Space>
      </div>
    </MainLayout>
  );
}; 