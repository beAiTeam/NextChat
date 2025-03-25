"use client";

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  ReloadOutlined,
  TrophyOutlined
} from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Modal, Row, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { Dayjs } from "dayjs";
import ReactECharts from 'echarts-for-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { LotAiGuessType } from "../types/ai";
import { safeLocalStorage } from "../utils";
import axiosServices from "../utils/my-axios";
import {
  BETTING_ODDS,
  calculateBetProfit,
  calculateTotalProfit,
  checkCurrentPeriodMatch,
  checkPeriodMatch,
  checkThreePeriodsMatch,
  checkTwoPeriodsMatch,
  DrawResult,
  formatGuessResult,
  GuessResult
} from "../utils/predict-utils";
import MainLayout from "./Layout";
import "./PredictMix.scss";
import { PredictStatsRef } from "./PredictStats";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

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

interface PredictProps {}

const PredictMix = ({}: PredictProps) => {
  const router = useRouter();
  const localStorage = safeLocalStorage();
  const hasLoadedFromStorage = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [defaultModel, setDefaultModel] = useState<LotAiGuessType>(LotAiGuessType.Ai5_Normal);
  const [assistModel, setAssistModel] = useState<LotAiGuessType>(LotAiGuessType.Ai5_Gemini_Plus);
  const [switchStrategy, setSwitchStrategy] = useState<number>(2);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [total, setTotal] = useState(0);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentAiType, setCurrentAiType] = useState<AiTypeConfig | null>(null);
  const [isDrawResultModalVisible, setIsDrawResultModalVisible] =
    useState(false);
  const [currentDrawResults, setCurrentDrawResults] = useState<
    DrawResult[] | null
  >(null);
  const statsRef = useRef<PredictStatsRef>(null);
  const [isWinStatusModalVisible, setIsWinStatusModalVisible] = useState(false);
  const [winStatusChartData, setWinStatusChartData] = useState<{
    defaultModelData: { time: string; value: number }[];
    assistModelData: { time: string; value: number }[];
  }>({ defaultModelData: [], assistModelData: [] });
  const [isChickenModalVisible, setIsChickenModalVisible] = useState(false);
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
  }>>([]);
  const [isProcessingChicken, setIsProcessingChicken] = useState(false);
  const [chickenTableSorter, setChickenTableSorter] = useState<{
    columnKey: string;
    order: 'ascend' | 'descend';
  }>({
    columnKey: 'currentWinRate',
    order: 'descend'
  });

  // 从localStorage读取保存的设置
  useEffect(() => {
    if (hasLoadedFromStorage.current) return;
    
    const savedDefaultModel = localStorage.getItem("predict_default_model");
    const savedAssistModel = localStorage.getItem("predict_assist_model");
    const savedStrategy = localStorage.getItem("predict_switch_strategy");
    const savedPageSize = localStorage.getItem("predict_page_size");

    console.log("load savedDefaultModel", savedDefaultModel);
    if (savedDefaultModel) {
      setDefaultModel(savedDefaultModel as LotAiGuessType);
    }
    if (savedAssistModel) {
      setAssistModel(savedAssistModel as LotAiGuessType);
    }
    if (savedStrategy) {
      setSwitchStrategy(parseInt(savedStrategy));
    }
    if (savedPageSize) {
      setPageSize(parseInt(savedPageSize));
    }
    
    hasLoadedFromStorage.current = true;
  }, []); // 只在组件挂载时读取一次

  // 当设置变化时保存到localStorage
  useEffect(() => {
    localStorage.setItem("predict_default_model", defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    localStorage.setItem("predict_assist_model", assistModel);
  }, [assistModel]);

  useEffect(() => {
    localStorage.setItem("predict_switch_strategy", switchStrategy.toString());
  }, [switchStrategy]);

  useEffect(() => {
    localStorage.setItem("predict_page_size", pageSize.toString());
  }, [pageSize]);

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

  // 处理中奖状态图表数据
  const processWinStatusData = (defaultData: PredictItem[], assistData: PredictItem[]) => {
    const defaultModelData = defaultData.map(item => {
      const date = new Date(item.guess_time * 1000);
      const today = new Date();
      const timeStr = date.toDateString() === today.toDateString()
        ? date.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : date.toLocaleString("zh-CN");

      return {
        time: timeStr,
        value: checkCurrentPeriodMatch(
          formatGuessResult(item.guess_result),
          item.ext_result,
          item.guess_period
        ) ? 1 : -1
      };
    });

    const assistModelData = assistData.map(item => {
      const date = new Date(item.guess_time * 1000);
      const today = new Date();
      const timeStr = date.toDateString() === today.toDateString()
        ? date.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : date.toLocaleString("zh-CN");

      return {
        time: timeStr,
        value: checkCurrentPeriodMatch(
          formatGuessResult(item.guess_result),
          item.ext_result,
          item.guess_period
        ) ? 1 : -1
      };
    });

    setWinStatusChartData({
      defaultModelData,
      assistModelData
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

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: size,
      };

      // 添加时间范围参数
      if (timeRange[0] && timeRange[1]) {
        params.start_time = Math.floor(timeRange[0].valueOf()/1000);
        params.end_time = Math.floor(timeRange[1].valueOf()/1000);
      }

      // 获取默认模型数据
      const defaultResponse = await axiosServices.get(
        "/client/lot/get_ai_guess_list",
        {
          params: {
            ...params,
            guess_type: defaultModel,
          },
        },
      );

      // 获取配合模型数据
      const assistResponse = await axiosServices.get(
        "/client/lot/get_ai_guess_list",
        {
          params: {
            ...params,
            guess_type: assistModel,
          },
        },
      );

      // 数据筛选逻辑
      const defaultData = defaultResponse.data.data.data;
      const assistData = assistResponse.data.data.data;
      const filteredData: PredictItem[] = [];
      
      // 从尾部开始遍历
      for (let i = defaultData.length - 1; i >= 0; i--) {
        const defaultItem = defaultData[i];
        const nextPeriod = defaultItem?.ext_result?.length>0 ? defaultItem.ext_result[0].draw_number: defaultItem.guess_period;
        const assistItem = assistData.find((item: PredictItem) => item.guess_period === nextPeriod);
        
        // 第一条数据（最后一期）使用默认模型
        if (i === defaultData.length - 1) {
          filteredData.unshift(defaultItem);
          continue;
        }


        // 获取历史数据来判断是否连续输
        var loseCount = (() => {
          
          // 其他切换策略继续使用原有的连输判断逻辑
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
        if (loseCount >= switchStrategy  ) {
          if(assistItem){
            filteredData.unshift(assistItem);
          }else{
            console.log("暂时没有对应辅助，所以这期不插入了",defaultItem.guess_period);
          }
         
        } else {
          filteredData.unshift(defaultItem);
        }
      }

      // 处理中奖状态图表数据
      processWinStatusData(defaultData, assistData);

      setData(filteredData);
      setTotal(defaultResponse.data.data.total);
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize, timeRange, defaultModel, assistModel,switchStrategy]);

  // 处理时间范围变化
  const handleTimeRangeChange = (newTimeRange: [Dayjs | null, Dayjs | null]) => {
    setTimeRange(newTimeRange);
    setCurrentPage(1); // 重置页码
  };

  // 添加刷新函数
  const handleRefresh = () => {
    setCurrentPage(1); // 重置页码为1
    fetchData(1, pageSize); // 刷新数据
    statsRef.current?.refresh(); // 刷新 PredictStats
  };

  const showAiTypeModal = (aiType: AiTypeConfig) => {
    setCurrentAiType(aiType);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const showDrawResultModal = (drawResults: DrawResult[] | null) => {
    if (!drawResults || drawResults.length === 0) {
      toast.error("暂无开奖结果");
      return;
    }
    setCurrentDrawResults(drawResults);
    setIsDrawResultModalVisible(true);
  };

  const handleDrawResultModalClose = () => {
    setIsDrawResultModalVisible(false);
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case "created":
        return <Tag color="blue">待预测</Tag>;
      case "drawed":
        return <Tag color="cyan">已开</Tag>;
      case "executing":
        return <Tag color="processing">执行中</Tag>;
      case "finished":
        return <Tag color="green">已完成</Tag>;
      case "failed":
        return <Tag color="red">失败</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  const renderHighlightedPrediction = (
    prediction: string,
    drawResults: DrawResult[] | null,
    guessPeriod?: string,
  ) => {
    if (!drawResults || drawResults.length === 0 || prediction === "暂无结果") {
      return prediction;
    }

    return (
      <span>
        {prediction.split("").map((digit, index) => {
          // 判断预测结果中的数字是否在任意一个开奖结果中出现
          let shouldHighlight = false;
          for (const drawResult of drawResults) {
            if (drawResult.full_number.includes(digit)) {
              shouldHighlight = true;
              break;
            }
          }

          // 新逻辑：第一位数字与正式结果中任意一个数字匹配则标红色，其他位匹配则标绿色
          const isFirstDigit = index === 0;

          return (
            <span
              key={index}
              className={
                shouldHighlight
                  ? isFirstDigit
                    ? "highlighted-digit-gold"
                    : "highlighted-digit"
                  : "digit"
              }
            >
              {digit}
            </span>
          );
        })}
      </span>
    );
  };

  const renderDrawResult = (record: PredictItem) => {
    // 当ext_result长度不等于3时，显示等待开奖结果
    if (!record.ext_result || record.ext_result.length === 0) {
      return "等待开奖结果";
    }

    const prediction = record.guess_result
      ? formatGuessResult(record.guess_result)
      : "";
    if (prediction === "暂无结果" || prediction.length === 0) {
      return prediction;
    }

    return (
      <div>
        {record.ext_result.map((drawResult, resultIndex) => {
          // 使用checkPeriodMatch检查这组开奖结果是否匹配预测结果
          const isMatched = checkPeriodMatch(prediction, drawResult);

          return (
            <div
              key={resultIndex}
              style={{
                marginBottom:
                  resultIndex < record.ext_result!.length - 1 ? "8px" : "0",
                padding: "4px 8px",
                backgroundColor: isMatched ? "#e6f7ff" : "transparent",
                borderRadius: "4px",
              }}
            >
              <span
                style={{ marginRight: "8px", fontSize: "12px", color: "#888" }}
              >
                {drawResult.draw_number}:
              </span>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => {
                  navigator.clipboard.writeText(drawResult.full_number);
                  toast.success("已复制到剪贴板");
                }}
              >
                {drawResult.full_number.split("").map((digit, index) => {
                  // 判断开奖结果中的数字是否在预测结果中出现
                  const isCommon = prediction.includes(digit);
                  // 如果预测结果的第一位与当前数字匹配，则标红色
                  const isFirstDigitMatch =
                    prediction.length > 0 && digit === prediction[0];

                  return (
                    <span
                      key={index}
                      className={
                        isCommon
                          ? isFirstDigitMatch
                            ? "highlighted-digit-gold"
                            : "highlighted-digit"
                          : "digit"
                      }
                    >
                      {digit}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleExportExcel = () => {
    // 准备Excel数据
    const exportData = data.map((item) => {
      // 获取匹配信息
      let matchInfo = "";
      if (item.ext_result && item.ext_result.length > 0 && item.guess_result) {
        const prediction = formatGuessResult(item.guess_result);
        const isCurrentPeriodMatch = checkCurrentPeriodMatch(
          prediction,
          item.ext_result,
          item.guess_period,
        );
        const matchedIndex = item.ext_result.findIndex((drawResult) => {
          return checkPeriodMatch(prediction, drawResult);
        });

        if (matchedIndex !== -1) {
          matchInfo = `，第${item.guess_period}期中了，开在第${
            matchedIndex + 1
          }期中`;
        }
      }

      const prediction = item.guess_result
        ? formatGuessResult(item.guess_result)
        : "暂无结果";
      const threePeriodsMatchResult = checkThreePeriodsMatch(
        prediction,
        item.ext_result,
      );

      // 找出在哪一期中的
      const matchedIndex = item.ext_result && item.ext_result.length > 0
        ? item.ext_result.findIndex((drawResult) => checkPeriodMatch(prediction, drawResult))
        : -1;

      return {
        期号: item.guess_period,
        预测策略: item.ai_type.name,
        预测结果: prediction,
        正式结果: item.ext_result
          ? item.ext_result.map((r) => r.full_number).join(", ") + matchInfo
          : "等待开奖结果",
        当期状态: checkCurrentPeriodMatch(
          prediction,
          item.ext_result,
          item.guess_period,
        )
          ? "中"
          : "未中",
        状态: threePeriodsMatchResult 
          ? `中${matchedIndex !== -1 ? (matchedIndex + 1) : ''}`
          : "未中",
        预测时间: new Date(item.guess_time * 1000).toLocaleString(),
      };
    });

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "预测数据");

    // 导出Excel文件
    XLSX.writeFile(wb, "predict_data.xlsx");
    toast.success("导出成功！");
  };

  const handleWinStatusModalClose = () => {
    setIsWinStatusModalVisible(false);
  };

  const showWinStatusModal = () => {
    setIsWinStatusModalVisible(true);
  };

  const columns = [
    {
      title: "期号",
      dataIndex: "guess_period",
      key: "guess_period",
      render: (text: string) => (
        <span
          style={{ cursor: "pointer" }}
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast.success("已复制到剪贴板");
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: "预测策略",
      key: "ai_type_name",
      render: (record: PredictItem) => (
        <span
          className="clickable-text"
          onClick={() => showAiTypeModal(record.ai_type)}
        >
          {record.ai_type.name}
        </span>
      ),
    },
    {
      title: "预测结果",
      key: "guess_result",
      render: (record: PredictItem) => {
        const resultText = formatGuessResult(record.guess_result);
        if (resultText === "暂无结果") return resultText;

        return (
          <span
            style={{ cursor: "pointer" }}
            onClick={() => {
              navigator.clipboard.writeText(resultText);
              toast.success("已复制到剪贴板");
            }}
          >
            {renderHighlightedPrediction(resultText, record.ext_result)}
          </span>
        );
      },
    },
    {
      title: "正式结果",
      key: "draw_result",
      width: 300,
      render: (record: PredictItem) => renderDrawResult(record),
    },
    // {
    //   title: "处理状态",
    //   key: "process_status",
    //   render: (record: PredictItem) => getStatusTag(record.draw_status),
    // },
    {
      title: "当期状态",
      key: "first_digit_match",
      render: (record: PredictItem) => {
        if (
          !record.guess_result ||
          !record.ext_result ||
          record.ext_result.length === 0
        ) {
          return "等待开奖结果";
        }

        // 检查是否存在匹配的期号
        const matchedDrawResult = record.ext_result.find(
          (drawResult) => drawResult.draw_number === record.guess_period,
        );

        // 如果找不到匹配的期号，返回等待开奖结果
        if (!matchedDrawResult) {
          return "等待开奖结果";
        }

        return checkCurrentPeriodMatch(
          formatGuessResult(record.guess_result),
          record.ext_result,
          record.guess_period,
        ) ? (
          <Tag color="success">
            <CheckCircleOutlined /> 中
          </Tag>
        ) : (
          <Tag color="error">
            <CloseCircleOutlined /> 未中
          </Tag>
        );
      },
    },
    {
      title: "状态",
      key: "win_status",
      render: (record: PredictItem) => {
        if (!record.ext_result || record.ext_result.length !== 3) {
          return "等待开奖结果";
        }

        const prediction = formatGuessResult(record.guess_result);
        const threePeriodsMatchResult = checkThreePeriodsMatch(
          prediction,
          record.ext_result,
        );

        if (threePeriodsMatchResult === null) {
          return "等待开奖结果";
        }

        // 找出是在哪一期中的
        const matchedIndex = record.ext_result.findIndex((drawResult) => 
          checkPeriodMatch(prediction, drawResult)
        );

        return threePeriodsMatchResult ? (
          <Tag color="success">
            <CheckCircleOutlined /> 中{matchedIndex !== -1 ? (matchedIndex + 1) : ''}
          </Tag>
        ) : (
          <Tag color="error">
            <CloseCircleOutlined /> 未中
          </Tag>
        );
      },
    },
    {
      title: () => {
        const totalProfit = calculateTotalProfit(data);
        return (
          <Tooltip title={`赔率：${BETTING_ODDS}`}>
            <span>
              盈亏
              <span style={{ 
                color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f',
                marginLeft: '4px'
              }}>
                ({totalProfit >= 0 ? '+' : ''}{totalProfit})
              </span>
            </span>
          </Tooltip>
        );
      },
      key: "profit",
      render: (record: PredictItem) => {
        const betResult = calculateBetProfit(
          formatGuessResult(record.guess_result),
          record.ext_result
        );

        if (betResult.betDetails === "等待开奖") {
          return betResult.betDetails;
        }

        return (
          <div>
            <span style={{ 
              color: betResult.profit >= 0 ? '#52c41a' : '#ff4d4f',
              marginRight: '8px'
            }}>
              {betResult.profit >= 0 ? '+' : ''}{betResult.profit}
            </span>
            <span style={{ color: '#8c8c8c', fontSize: '12px' }}>
              ({betResult.betDetails})
            </span>
          </div>
        );
      },
    },
    {
      title: "预测时间",
      dataIndex: "guess_time",
      key: "guess_time",
      render: (timestamp: number) =>
        new Date(timestamp * 1000).toLocaleString(),
    },
  ];

  return (
    <MainLayout>
      <div className="predict-container">
        <div className="predict-header">
          <h4>混合预测 </h4>
          <div className="select-ai-type">
            默认:
            <Select
              style={{ width: 200, marginRight: 16 }}
              value={defaultModel}
              onChange={(value) => setDefaultModel(value)}
              placeholder="选择默认模型"
            >
              {Object.values(LotAiGuessType).map((type) => (
                <Select.Option key={type} value={type}>
                  {type}
                </Select.Option>
              ))}
            </Select>
            <span style={{marginRight: '10px'}}>配合:</span>
            <Select
              style={{ width: 200, marginRight: 16 }}
              value={assistModel}
              onChange={(value) => setAssistModel(value)}
              placeholder="选择配合模型"
            >
              {Object.values(LotAiGuessType).map((type) => (
                <Select.Option key={type} value={type}>
                  {type}
                </Select.Option>
              ))}
            </Select>
            <span style={{marginRight: '10px'}}>切换策略:</span>
            <Select
              style={{ width: 120 }}
              value={switchStrategy}
              onChange={(value) => setSwitchStrategy(value)}
              placeholder="选择切换策略"
            >
              <Select.Option value={1}>输1期切换</Select.Option>
              <Select.Option value={2}>连输2期切换</Select.Option>
              <Select.Option value={3}>连输3期切换</Select.Option>
              <Select.Option value={4}>连输4期切换</Select.Option>
              <Select.Option value={5}>连输5期切换</Select.Option>
              <Select.Option value={6}>连输6期切换</Select.Option>
            </Select>
          </div>
          <div className="predict-controls">
            <Button
              icon={<TrophyOutlined />}
              onClick={() => router.push('/chicken-analysis')}
              style={{ marginRight: 8 }}
            >
              吃鸡
            </Button>
            <Button
              icon={<LineChartOutlined />}
              onClick={showWinStatusModal}
              style={{ marginRight: 8 }}
            >
              中奖状态图
            </Button>
            <Button
              type="primary"
              onClick={handleExportExcel}
              className="export-button"
            >
              导出Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </div>
        </div>

        <div style={{marginBottom: '16px'}}>
          <Space>
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              onChange={(dates: any, dateStrings: [string, string]) => {
                handleTimeRangeChange(dates);
              }}
              value={timeRange}
              style={{ minWidth: '300px' }}
            />
          </Space>
          <span style={{marginLeft: '10px'}}>【按当期状态来决定下期采用哪个模型预测】</span>
        </div>

        <div className="predict-table-container">
          <div style={{ marginBottom: '16px' }}>
            {(() => {
              const stats = calculateWinRates(data);
              return (
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span>
                    当期胜率：
                    <span style={{ color: '#1890ff' }}>
                      {stats.current.rate}%
                    </span>
                    <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                      ({stats.current.win}/{stats.current.total})
                    </span>
                  </span>
                  <span>
                    两期胜率：
                    <span style={{ color: '#1890ff' }}>
                      {stats.two.rate}%
                    </span>
                    <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                      ({stats.two.win}/{stats.two.total})
                    </span>
                  </span>
                  <span>
                    三期胜率：
                    <span style={{ color: '#1890ff' }}>
                      {stats.three.rate}%
                    </span>
                    <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                      ({stats.three.win}/{stats.three.total})
                    </span>
                  </span>
                </div>
              );
            })()}
          </div>
          <Table
            loading={loading}
            columns={columns}
            dataSource={data}
            rowKey="_id"
            scroll={{ y: "calc(100vh - 250px)" }}
            className="selectable-table"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: (page: number, size: number) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              pageSizeOptions: [
                "8",
                "10",
                "20",
                "50",
                "100",
                "200",
                "500",
                "1000",
                "2000",
                "5000",
              ],
              showTotal: (total: number) => `共 ${total} 条数据`,
            }}
          />
        </div>

        {/* AI类型详情模态框 */}
        <Modal
          title={
            <div>
              <InfoCircleOutlined
                style={{ marginRight: "8px", color: "#1890ff" }}
              />
              预测策略详情
            </div>
          }
          open={isModalVisible}
          onCancel={handleModalClose}
          footer={[
            <Button key="close" onClick={handleModalClose}>
              关闭
            </Button>,
          ]}
          width={800}
          className="ai-type-modal"
        >
          {currentAiType && (
            <div className="ai-type-details">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="基本信息" bordered={false}>
                    <p>
                      <strong>策略名称:</strong> {currentAiType.name}
                    </p>
                    <p>
                      <strong>策略类型:</strong> {currentAiType.type}
                    </p>
                    <p>
                      <strong>使用模型:</strong> {currentAiType.config.model}
                    </p>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title="Prompt 内容" bordered={false}>
                    <div className="prompt-content">
                      <pre>{currentAiType.config.prompt}</pre>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </Modal>

        {/* 开奖结果模态框 */}
        <Modal
          title={
            <div>
              <InfoCircleOutlined
                style={{ marginRight: "8px", color: "#1890ff" }}
              />
              开奖结果详情
            </div>
          }
          open={isDrawResultModalVisible}
          onCancel={handleDrawResultModalClose}
          footer={[
            <Button key="close" onClick={handleDrawResultModalClose}>
              关闭
            </Button>,
          ]}
          width={600}
          className="draw-result-modal"
        >
          {currentDrawResults && (
            <div className="draw-result-details">
              <Table
                dataSource={currentDrawResults}
                rowKey="draw_number"
                pagination={false}
                columns={[
                  {
                    title: "期号",
                    dataIndex: "draw_number",
                    key: "draw_number",
                  },
                  {
                    title: "开奖号码",
                    dataIndex: "full_number",
                    key: "full_number",
                  },
                  {
                    title: "开奖时间",
                    dataIndex: "draw_time",
                    key: "draw_time",
                    render: (timestamp: number) =>
                      new Date(timestamp * 1000).toLocaleString(),
                  },
                ]}
              />
            </div>
          )}
        </Modal>

        {/* 中奖状态图模态框 */}
        <Modal
          title={
            <div>
              <LineChartOutlined style={{ marginRight: "8px", color: "#1890ff" }} />
              中奖状态对比图
            </div>
          }
          open={isWinStatusModalVisible}
          onCancel={handleWinStatusModalClose}
          footer={[
            <Button key="close" onClick={handleWinStatusModalClose}>
              关闭
            </Button>,
          ]}
          width={1000}
          className="win-status-modal"
        >
          <Card>
            <ReactECharts
              option={{
                title: {
                  text: '模型中奖状态对比',
                  left: 'center'
                },
                tooltip: {
                  trigger: 'axis',
                  formatter: function(params: any) {
                    let result = params[0].name + '<br/>';
                    params.forEach((param: any) => {
                      const modelName = param.seriesName;
                      const status = param.value > 0 ? '中奖' : '未中奖';
                      const color = param.color;
                      const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
                      result += `${marker}${modelName}: ${status}<br/>`;
                    });
                    return result;
                  }
                },
                legend: {
                  data: ['默认模型', '配合模型'],
                  top: '30px'
                },
                grid: {
                  top: '80px',
                  bottom: '40px',
                  left: '3%',
                  right: '4%',
                  containLabel: true
                },
                xAxis: {
                  type: 'category',
                  data: winStatusChartData.defaultModelData.map(item => item.time),
                  axisLabel: {
                    rotate: 45,
                    interval: Math.floor(winStatusChartData.defaultModelData.length / 10)
                  }
                },
                yAxis: {
                  type: 'value',
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
                series: [
                  {
                    name: '默认模型',
                    type: 'line',
                    data: winStatusChartData.defaultModelData.map(item => item.value),
                    step: 'middle',
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: {
                      color: '#2593fc'
                    },
                    lineStyle: {
                      width: 2
                    }
                  },
                  {
                    name: '配合模型',
                    type: 'line',
                    data: winStatusChartData.assistModelData.map(item => item.value),
                    step: 'middle',
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: {
                      color: '#52c41a'
                    },
                    lineStyle: {
                      width: 2
                    }
                  }
                ]
              }}
              style={{ height: '500px' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Modal>
      </div>
    </MainLayout>
  );
};

export default PredictMix;
