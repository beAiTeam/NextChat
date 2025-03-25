"use client";

import { Button, Card, Input, Space, Table } from "antd";
import ReactECharts from 'echarts-for-react';
import { useRouter } from 'next/navigation';
import { useState } from "react";
import toast from "react-hot-toast";
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

interface AiTypeConfig {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  type: string;
  config: {
    prompt: string;
    model: string;
  };
}

interface PredictItem {
  _id: string;
  created_at: string;
  updated_at: string;
  guess_period: string;
  guess_time: number;
  guess_result: GuessResult | null;
  guess_type: string;
  ext_result: DrawResult[] | null;
  ai_type: AiTypeConfig;
  draw_status: "created" | "drawed" | "executing" | "finished" | "failed";
  retry_count: number;
  is_success: boolean;
}

const ChickenAnalysis = () => {
  const router = useRouter();
  const localStorage = safeLocalStorage();
  const [chickenDataLimit, setChickenDataLimit] = useState(50);
  const [chickenResults, setChickenResults] = useState<Array<{
    defaultModel: LotAiGuessType;
    assistModel: LotAiGuessType;
    switchStrategy: number;
    winRate: string;
    totalCount: number;
    winCount: number;
    currentWinRate?: string;
    currentTotalCount?: number;
    currentWinCount?: number;
    twoWinRate?: string;
    twoTotalCount?: number;
    twoWinCount?: number;
    isLoading: boolean;
    isComplete: boolean;
    balanceData?: Array<{ time: string; balance: number }>;
    baseData?: Array<{ time: string; balance: number }>;
  }>>([]);
  const [isProcessingChicken, setIsProcessingChicken] = useState(false);
  const [chickenTableSorter, setChickenTableSorter] = useState<{
    columnKey: string;
    order: 'ascend' | 'descend';
  }>({
    columnKey: 'currentWinRate',
    order: 'descend'
  });

  const [betConfig, setBetConfig] = useState<BetConfig>(() => {
    try {
      const savedConfig = localStorage.getItem("betConfig");
      return savedConfig ? JSON.parse(savedConfig) : { x: 1, y: 2, z: 4 };
    } catch {
      return { x: 1, y: 2, z: 4 };
    }
  });

  // 处理倍投配置变化
  const handleBetConfigChange = (key: "x" | "y" | "z", value: string) => {
    // 确保输入为正数，且不超过100
    const numValue = Math.min(Math.max(Number(value) || 0, 0), 100);
    const newConfig = { ...betConfig, [key]: numValue };
    setBetConfig(newConfig);
    try {
      localStorage.setItem("betConfig", JSON.stringify(newConfig));
    } catch (error) {
      console.error("Failed to save bet config:", error);
    }
    // 重新计算所有组合的余额数据
    handleChickenAnalysis();
  };

  // 添加胜率计算函数
  const calculateWinRates = (items: PredictItem[]) => {
    // 筛选有效数据
    const validCurrentItems = items.filter(item => item.ext_result?.length > 0 && item.guess_result);
    const validTwoItems = items.filter(item => item.ext_result?.length >= 2 && item.guess_result);
    const validThreeItems = items.filter(item => item.ext_result?.length >= 3 && item.guess_result);

    // 计算当期胜率
    const currentWinCount = validCurrentItems.filter(item => {
      const prediction = formatGuessResult(item.guess_result);
      return checkCurrentPeriodMatch(prediction, item.ext_result, item.guess_period);
    }).length;
    const currentWinRate = validCurrentItems.length > 0 
      ? (currentWinCount / validCurrentItems.length * 100).toFixed(2)
      : '0.00';

    // 计算两期胜率
    const twoWinCount = validTwoItems.filter(item => {
      const prediction = formatGuessResult(item.guess_result);
      return checkTwoPeriodsMatch(prediction, item.ext_result);
    }).length;
    const twoWinRate = validTwoItems.length > 0
      ? (twoWinCount / validTwoItems.length * 100).toFixed(2)
      : '0.00';

    // 计算三期胜率
    const threeWinCount = validThreeItems.filter(item => {
      const prediction = formatGuessResult(item.guess_result);
      return checkThreePeriodsMatch(prediction, item.ext_result);
    }).length;
    const threeWinRate = validThreeItems.length > 0
      ? (threeWinCount / validThreeItems.length * 100).toFixed(2)
      : '0.00';

    return {
      current: { rate: currentWinRate, total: validCurrentItems.length, win: currentWinCount },
      two: { rate: twoWinRate, total: validTwoItems.length, win: twoWinCount },
      three: { rate: threeWinRate, total: validThreeItems.length, win: threeWinCount }
    };
  };

  // 生成余额变化数据
  const generateBalanceData = (items: PredictItem[]) => {
    const sortedItems = [...items].sort((a, b) => a.guess_time - b.guess_time);
    return sortedItems.map((item, index) => {
      const currentItems = sortedItems.slice(0, index + 1);
      let totalBalance = 0;

      currentItems.forEach((currentItem) => {
        const balanceResult = calculateBalanceChange(
          formatGuessResult(currentItem.guess_result),
          currentItem.ext_result,
          betConfig,
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
  };

  // 添加一个延时函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 添加带重试机制的API请求函数
  const fetchWithRetry = async (url: string, options: any, retries = 2, delayMs = 6000) => {
    try {
      return await axiosServices.get(url, options);
    } catch (error) {
      if (retries <= 0) throw error;
      
      console.log(`请求失败，${delayMs/1000}秒后重试，剩余重试次数: ${retries}`);
      await delay(delayMs);
      return fetchWithRetry(url, options, retries - 1, delayMs);
    }
  };

  // 处理吃鸡分析
  const handleChickenAnalysis = async () => {
    setIsProcessingChicken(true);
    
    try {
      // 获取所有模型
      const allModels = Object.values(LotAiGuessType);
      
      // 构建参数 - 请求更多数据用于胜率计算
      const baseParams: any = {
        page: 1,
        page_size: chickenDataLimit * 3, // 获取3倍数据，前2倍用作基底计算
      };

      const displayParams: any = {
        page: 1,
        page_size: chickenDataLimit,
      };
      
      // 用于存储每个模型的数据
      const modelDataMap: Record<string, PredictItem[]> = {};
      const modelBaseDataMap: Record<string, PredictItem[]> = {};
      
      // 最多同时处理4个请求
      const MAX_CONCURRENT_REQUESTS = 4;
      let activeRequests = 0;
      let queueIndex = 0;
      
      // 使用Promise处理请求队列
      await new Promise<void>(async (resolve) => {
        // 处理单个模型请求的函数
        const fetchModelData = async (index: number) => {
          if (index >= allModels.length) {
            // 所有模型数据都已请求完毕
            if (activeRequests === 0) {
              resolve();
            }
            return;
          }
          
          activeRequests++;
          const modelType = allModels[index];
          
          try {
            // 获取基底数据 - 使用带重试的请求
            const baseResponse = await fetchWithRetry(
              "/client/lot/get_ai_guess_list",
              {
                params: {
                  ...baseParams,
                  guess_type: modelType,
                },
              },
              2,
              6000
            );
            
            // 获取显示数据 - 使用带重试的请求
            const displayResponse = await fetchWithRetry(
              "/client/lot/get_ai_guess_list",
              {
                params: {
                  ...displayParams,
                  guess_type: modelType,
                },
              },
              2,
              6000
            );
            
            // 保存模型数据
            modelBaseDataMap[modelType] = baseResponse.data.data.data;
            modelDataMap[modelType] = displayResponse.data.data.data;
          } catch (error) {
            console.error(`获取模型 ${modelType} 数据失败:`, error);
            modelBaseDataMap[modelType] = [];
            modelDataMap[modelType] = [];
          } finally {
            activeRequests--;
            
            // 处理队列中的下一个请求
            queueIndex++;
            fetchModelData(queueIndex);
          }
        };
        
        // 启动初始的并发请求
        const initialBatch = Math.min(MAX_CONCURRENT_REQUESTS, allModels.length);
        for (let i = 0; i < initialBatch; i++) {
          fetchModelData(i);
        }
        queueIndex = initialBatch - 1;
      });
      
      // 所有模型数据获取完毕后，生成所有可能的组合
      const modelCombinations: Array<{
        defaultModel: LotAiGuessType;
        assistModel: LotAiGuessType;
      }> = [];
      
      // 生成所有模型组合
      allModels.forEach(defaultModel => {
        allModels.forEach(assistModel => {
          if (defaultModel !== assistModel) { // 避免相同模型组合
            modelCombinations.push({
              defaultModel,
              assistModel
            });
          }
        });
      });
      
      // 初始化结果数组 - 包含所有模型组合和切换策略
      const allStrategyResults: Array<{
        defaultModel: LotAiGuessType;
        assistModel: LotAiGuessType;
        switchStrategy: number;
        winRate: string;
        totalCount: number;
        winCount: number;
        currentWinRate: string;
        currentTotalCount: number;
        currentWinCount: number;
        twoWinRate: string;
        twoTotalCount: number;
        twoWinCount: number;
        isLoading: boolean;
        isComplete: boolean;
        balanceData: Array<{ time: string; balance: number }>;
        baseData?: Array<{ time: string; balance: number }>;
      }> = [];
      
      // 为每个模型组合创建切换策略的初始结果
      modelCombinations.forEach(combination => {
        [1, 2, 3, 4, 5, 6].forEach(strategy => {
          allStrategyResults.push({
            ...combination,
            switchStrategy: strategy,
            winRate: '0.00',
            totalCount: 0,
            winCount: 0,
            currentWinRate: '0.00',
            currentTotalCount: 0,
            currentWinCount: 0,
            twoWinRate: '0.00',
            twoTotalCount: 0,
            twoWinCount: 0,
            isLoading: false,
            isComplete: true,
            balanceData: [],
            baseData: []
          });
        });
      });
      
      // 对每个组合和策略进行模拟
      for (const result of allStrategyResults) {
        const defaultData = modelDataMap[result.defaultModel] || [];
        const assistData = modelDataMap[result.assistModel] || [];
        const defaultBaseData = modelBaseDataMap[result.defaultModel] || [];
        const assistBaseData = modelBaseDataMap[result.assistModel] || [];
        
        if (defaultData.length === 0 || assistData.length === 0) {
          continue;
        }
        
        // 处理基底数据
        const baseFilteredData = processStrategyData(defaultBaseData, assistBaseData, result.switchStrategy);
        result.baseData = generateBalanceData(baseFilteredData);
        
        // 处理显示数据
        const filteredData = processStrategyData(defaultData, assistData, result.switchStrategy);
        
        // 计算胜率
        const stats = calculateWinRates(filteredData);
        
        // 计算余额变化数据
        const balanceData = generateBalanceData(filteredData);
        
        // 更新结果
        result.winRate = stats.three.rate;
        result.totalCount = stats.three.total;
        result.winCount = stats.three.win;
        result.currentWinRate = stats.current.rate;
        result.currentTotalCount = stats.current.total;
        result.currentWinCount = stats.current.win;
        result.twoWinRate = stats.two.rate;
        result.twoTotalCount = stats.two.total;
        result.twoWinCount = stats.two.win;
        result.balanceData = balanceData;
      }
      
      // 按当期胜率排序
      const sortedResults = [...allStrategyResults].sort((a, b) => {
        return Number(parseFloat(b.currentWinRate)) - Number(parseFloat(a.currentWinRate));
      });
      
      setChickenResults(sortedResults);
    } catch (error) {
      console.error("分析失败:", error);
      toast.error("分析过程中出错");
    } finally {
      setIsProcessingChicken(false);
    }
  };

  // 处理策略数据的辅助函数
  const processStrategyData = (defaultData: PredictItem[], assistData: PredictItem[], switchStrategy: number) => {
    const filteredData: PredictItem[] = [];
    
    // 从尾部开始遍历
    for (let i = defaultData.length - 1; i >= 0; i--) {
      const defaultItem = defaultData[i];
      const nextPeriod = defaultItem?.ext_result?.length>0 ? defaultItem.ext_result[0].draw_number: 'empty';
      const assistItem = assistData.find((item: PredictItem) => item.guess_period === nextPeriod);
      
      // 第一条数据（最后一期）使用默认模型
      if (i === defaultData.length - 1) {
        filteredData.unshift(defaultItem);
        continue;
      }
      
      // 获取历史数据来判断是否连续输
      const loseCount = (() => {
        let count = 0;
        for (let j = 0; j < switchStrategy; j++) {
          if (filteredData.length <= j) break;
          const item = filteredData[j];
          const prediction = formatGuessResult(item.guess_result);
          const isLose = !checkCurrentPeriodMatch(prediction, item.ext_result, item.guess_period);
          if (isLose && item.ai_type.name === defaultItem.ai_type.name) {
            count++;
          } else {
            break;
          }
        }
        return count;
      })();
      
      // 如果连续输的次数达到切换策略要求，使用配合模型
      if (loseCount >= switchStrategy && assistItem) {
        filteredData.unshift(assistItem);
      } else {
        filteredData.unshift(defaultItem);
      }
    }
    
    return filteredData;
  };

  // 选择某个组合
  const handleSelectCombination = (item: {
    defaultModel: LotAiGuessType;
    assistModel: LotAiGuessType;
    switchStrategy: number;
  }) => {
    // 保存到localStorage
    localStorage.setItem("predict_default_model", item.defaultModel);
    localStorage.setItem("predict_assist_model", item.assistModel);
    localStorage.setItem("predict_switch_strategy", item.switchStrategy.toString());
    
    // 跳转到混合预测页面
    router.push('/predict-mix');
    
    // 提示用户
    toast.success('配置已更新');
  };

  // 渲染余额变化趋势图
  const renderBalanceChart = (results: Array<{
    defaultModel: LotAiGuessType;
    assistModel: LotAiGuessType;
    switchStrategy: number;
    balanceData?: Array<{ time: string; balance: number }>;
  }>) => {
    // 生成不同的颜色
    const generateColor = (index: number) => {
      const colors = [
        '#2593fc', '#52c41a', '#ff4d4f', '#faad14', '#722ed1', '#13c2c2',
        '#eb2f96', '#1890ff', '#fa8c16', '#a0d911', '#9254de', '#36cfc9'
      ];
      return colors[index % colors.length];
    };

    // 找出所有时间点
    const allTimes = new Set<string>();
    results.forEach(result => {
      result.balanceData?.forEach(item => {
        allTimes.add(item.time);
      });
    });
    const timeArray = Array.from(allTimes).sort();

    const balanceOption = {
      title: {
        text: '余额变化趋势对比',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: function(params: any) {
          // 只取当前悬停的数据点
          const param = Array.isArray(params) ? params[0] : params;
          const color = param.color;
          const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
          const value = param.value === null ? '暂无数据' : param.value.toFixed(2);
          return `${param.name}<br/>${marker}${param.seriesName}: ${value}`;
        },
        axisPointer: {
          type: 'line',
          label: {
            backgroundColor: '#6a7985'
          }
        }
      },
      legend: {
        data: results.map(item => `${item.defaultModel}+${item.assistModel}(${item.switchStrategy}期)`),
        top: 30,
        type: 'scroll',
        width: '80%',
        textStyle: {
          fontSize: 12
        },
        selected: results.reduce((acc, item, index) => {
          // 默认只显示前5条线
          acc[`${item.defaultModel}+${item.assistModel}(${item.switchStrategy}期)`] = index < 5;
          return acc;
        }, {} as Record<string, boolean>)
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
        data: timeArray,
        axisLabel: {
          rotate: 45,
          interval: Math.floor(timeArray.length / 10)
        }
      },
      yAxis: {
        type: 'value' as const,
        name: '余额',
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed' as const
          }
        }
      },
      series: results.map((result, index) => ({
        name: `${result.defaultModel}+${result.assistModel}(${result.switchStrategy}期)`,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'lttb',
        data: timeArray.map(time => {
          const dataPoint = result.balanceData?.find(item => item.time === time);
          return dataPoint ? dataPoint.balance : null;
        }),
        itemStyle: {
          color: generateColor(index)
        },
        lineStyle: {
          width: 2
        }
      })),
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          {
            yAxis: 0,
            lineStyle: {
              color: '#ff4d4f',
              width: 2,
              type: 'solid' as const
            }
          }
        ]
      }
    };

    return (
      <Card>
        <ReactECharts
          option={balanceOption}
          style={{ height: '600px' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </Card>
    );
  };

  // 渲染胜率趋势图
  const renderWinRateChart = (results: Array<{
    defaultModel: LotAiGuessType;
    assistModel: LotAiGuessType;
    switchStrategy: number;
    balanceData?: Array<{ time: string; balance: number }>;
    currentWinRate?: string;
  }>) => {
    // 生成不同的颜色
    const generateColor = (index: number) => {
      const colors = [
        '#2593fc', '#52c41a', '#ff4d4f', '#faad14', '#722ed1', '#13c2c2',
        '#eb2f96', '#1890ff', '#fa8c16', '#a0d911', '#9254de', '#36cfc9'
      ];
      return colors[index % colors.length];
    };

    // 找出最近chickenDataLimit条数据的时间点
    const allTimes = new Set<string>();
    results.forEach(result => {
      const recentData = result.balanceData?.slice(-chickenDataLimit);
      recentData?.forEach(item => {
        allTimes.add(item.time);
      });
    });
    const timeArray = Array.from(allTimes).sort();

    const winRateOption = {
      title: {
        text: '胜率趋势对比',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: function(params: any) {
          // 只取当前悬停的数据点
          const param = Array.isArray(params) ? params[0] : params;
          const color = param.color;
          const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
          const value = param.value === null ? '暂无数据' : param.value.toFixed(2);
          return `${param.name}<br/>${marker}${param.seriesName}: ${value}%`;
        },
        axisPointer: {
          type: 'line' as const,
          label: {
            backgroundColor: '#6a7985'
          }
        }
      },
      legend: {
        data: results.map(item => `${item.defaultModel}+${item.assistModel}(${item.switchStrategy}期)`),
        top: 30,
        type: 'scroll',
        width: '80%',
        textStyle: {
          fontSize: 12
        },
        selected: results.reduce((acc, item, index) => {
          // 默认只显示前5条线
          acc[`${item.defaultModel}+${item.assistModel}(${item.switchStrategy}期)`] = index < 5;
          return acc;
        }, {} as Record<string, boolean>)
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
        data: timeArray,
        axisLabel: {
          rotate: 45,
          interval: Math.floor(timeArray.length / 10)
        }
      },
      yAxis: {
        type: 'value' as const,
        name: '胜率(%)',
        min: 0,
        max: 100,
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed' as const
          }
        }
      },
      series: results.map((result, index) => {
        // 计算每个时间点的累计胜率
        const winRateData = timeArray.map(time => {
          // 获取到当前时间点为止的所有数据（包括基底数据）
          const dataPoints = result.balanceData?.filter(item => item.time <= time) || [];
          if (dataPoints.length === 0) return null;

          // 计算累计胜率
          let winCount = 0;
          let totalCount = 0;

          dataPoints.forEach((item, idx) => {
            // 只统计最近chickenDataLimit条数据的胜率
            if (idx >= dataPoints.length - chickenDataLimit) {
              const isWin = item.balance > 0;
              if (isWin) winCount++;
              totalCount++;
            }
          });

          return totalCount > 0 ? (winCount / totalCount * 100) : null;
        });

        return {
          name: `${result.defaultModel}+${result.assistModel}(${result.switchStrategy}期)`,
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          sampling: 'lttb' as const,
          data: winRateData,
          itemStyle: {
            color: generateColor(index)
          },
          lineStyle: {
            width: 2
          }
        };
      }),
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
    };

    return (
      <Card>
        <ReactECharts
          option={winRateOption}
          style={{ height: '600px' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="chicken-analysis-container">
        <div style={{ marginBottom: '16px' }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space>
              <span>数据量:</span>
              <Input
                type="number"
                value={chickenDataLimit}
                onChange={(e) => setChickenDataLimit(parseInt(e.target.value) || 50)}
                style={{ width: '150px' }}
                min={1}
                max={5000}
              />
              <span>倍投配置：</span>
              <Space>
                X:
                <Input
                  type="number"
                  value={betConfig.x}
                  onChange={(e) => handleBetConfigChange("x", e.target.value)}
                  style={{ width: 180 }}
                  min={0}
                  max={1000}
                />
                Y:
                <Input
                  type="number"
                  value={betConfig.y}
                  onChange={(e) => handleBetConfigChange("y", e.target.value)}
                  style={{ width: 180 }}
                  min={0}
                  max={1000}
                />
                Z:
                <Input
                  type="number"
                  value={betConfig.z}
                  onChange={(e) => handleBetConfigChange("z", e.target.value)}
                  style={{ width: 180 }}
                  min={0}
                  max={1000}
                />
              </Space>
              <Button 
                type="primary" 
                onClick={handleChickenAnalysis}
                loading={isProcessingChicken}
                disabled={isProcessingChicken}
              >
                开始分析
              </Button>
            </Space>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
              注: 将根据当前选择的时间范围，分析每种组合策略的胜率表现
            </div>
          </Space>
        </div>

        {chickenResults.length > 0 && (
          <Space direction="vertical" size="large" style={{ width: '100%', marginBottom: '24px' }}>
            <Table
              dataSource={chickenResults}
              rowKey={(record) => `${record.defaultModel}-${record.assistModel}-${record.switchStrategy}`}
              pagination={false}
              loading={isProcessingChicken && chickenResults.length === 0}
              scroll={{ y: 500 }}
              onChange={(pagination, filters, sorter: any) => {
                if (sorter && sorter.columnKey) {
                  setChickenTableSorter({
                    columnKey: sorter.columnKey,
                    order: sorter.order
                  });
                }
              }}
              columns={[
                {
                  title: '默认模型',
                  dataIndex: 'defaultModel',
                  key: 'defaultModel',
                },
                {
                  title: '配合模型',
                  dataIndex: 'assistModel',
                  key: 'assistModel',
                },
                {
                  title: '切换策略',
                  dataIndex: 'switchStrategy',
                  key: 'switchStrategy',
                  render: (value) => `连输${value}期切换`,
                },
                {
                  title: '当期胜率',
                  key: 'currentWinRate',
                  render: (_, record) => {
                    if (record.isLoading) {
                      return <span>计算中...</span>;
                    }
                    return (
                      <span style={{ color: '#1890ff' }}>
                        {record.currentWinRate}%
                        <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                          ({record.currentWinCount}/{record.currentTotalCount})
                        </span>
                      </span>
                    );
                  },
                  sorter: (a, b) => Number(parseFloat(b.currentWinRate || '0')) - Number(parseFloat(a.currentWinRate || '0')),
                  sortOrder: chickenTableSorter.columnKey === 'currentWinRate' ? chickenTableSorter.order : null,
                  defaultSortOrder: 'descend',
                },
                {
                  title: '两期胜率',
                  key: 'twoWinRate',
                  render: (_, record) => {
                    if (record.isLoading) {
                      return <span>计算中...</span>;
                    }
                    return (
                      <span style={{ color: '#1890ff' }}>
                        {record.twoWinRate}%
                        <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                          ({record.twoWinCount}/{record.twoTotalCount})
                        </span>
                      </span>
                    );
                  },
                  sorter: (a, b) => Number(parseFloat(b.twoWinRate || '0')) - Number(parseFloat(a.twoWinRate || '0')),
                  sortOrder: chickenTableSorter.columnKey === 'twoWinRate' ? chickenTableSorter.order : null,
                },
                {
                  title: '三期胜率',
                  key: 'winRate',
                  render: (_, record) => {
                    if (record.isLoading) {
                      return <span>计算中...</span>;
                    }
                    return (
                      <span style={{ color: '#1890ff' }}>
                        {record.winRate}%
                        <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                          ({record.winCount}/{record.totalCount})
                        </span>
                      </span>
                    );
                  },
                  sorter: (a, b) => Number(parseFloat(b.winRate || '0')) - Number(parseFloat(a.winRate || '0')),
                  sortOrder: chickenTableSorter.columnKey === 'winRate' ? chickenTableSorter.order : null,
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={() => handleSelectCombination(record)}
                      disabled={record.isLoading}
                    >
                      设置当前配置
                    </Button>
                  ),
                }
              ]}
            />
            {renderWinRateChart(chickenResults)}
            {renderBalanceChart(chickenResults)}
          </Space>
        )}
      </div>
    </MainLayout>
  );
};

export default ChickenAnalysis; 