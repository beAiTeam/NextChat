"use client";

import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined,
    ReloadOutlined
} from "@ant-design/icons";
import { Button, Card, Col, Modal, Row, Table, Tag, Tooltip, Typography } from "antd";
import { Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { safeLocalStorage } from "../utils";
import axiosServices from "../utils/my-axios";
import {
    BETTING_ODDS,
    calculateBetProfit,
    calculateTotalProfit,
    checkCurrentPeriodMatch,
    checkPeriodMatch,
    checkThreePeriodsMatch,
    DrawResult,
    formatGuessResult,
    GuessResult
} from "../utils/predict-utils";
import MainLayout from "./Layout";
import "./Predict.scss";
import PredictStats, { PredictStatsRef } from "./PredictStats";

const { Title, Text, Paragraph } = Typography;

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

interface PredictProps {
  guess_type: string;
}

const Predict = ({ guess_type }: PredictProps) => {
  const localStorage = safeLocalStorage();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    // 尝试从localStorage读取保存的pageSize
    const savedPageSize = localStorage.getItem("predict_page_size");
    return savedPageSize ? parseInt(savedPageSize) : 100;
  });
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

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: size,
        guess_type: guess_type,
      };

      // 添加时间范围参数
      if (timeRange[0] && timeRange[1]) {
        params.start_time = Math.floor(timeRange[0].valueOf()/1000);
        params.end_time = Math.floor(timeRange[1].valueOf()/1000);
      }

      const response = await axiosServices.get(
        "/client/lot/get_ai_guess_list",
        {
          params,
        },
      );
      setData(response.data.data.data);
      setTotal(response.data.data.total);
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize, timeRange]);

  // 当pageSize变化时保存到localStorage
  useEffect(() => {
    localStorage.setItem("predict_page_size", pageSize.toString());
  }, [pageSize]);

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
          <h4>{guess_type}</h4>
          <div className="select-ai-type"></div>
          <div className="predict-controls">
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
        <PredictStats 
          ref={statsRef}
          guess_type={guess_type}
          defaultPageSize={100}
          defaultWinType="current"
          onDataChange={(data, beforeData) => {
            console.log('数据更新:', data);
            console.log('之前数据:', beforeData);
          }}
          onWinTypeChange={(type) => console.log('胜率类型更新:', type)}
          onTimeRangeChange={handleTimeRangeChange}
         />

        <div className="predict-table-container">
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
      </div>
    </MainLayout>
  );
};

export default Predict;
