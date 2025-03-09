"use client";

import { Table, Button, Card, Row, Col, Tag, Modal, Typography, Divider, Tooltip, Badge } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import './Predict.scss';
import toast from 'react-hot-toast';
import MainLayout from './Layout';
import { ReloadOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { safeLocalStorage } from "../utils";

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
  ai_type: AiTypeConfig;
  draw_status: 'created' | 'drawed' | 'executing' | 'finished' | 'failed';
  retry_count: number;
  is_success: boolean;
}

const Predict = () => {
  const localStorage = safeLocalStorage();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    // 尝试从localStorage读取保存的pageSize
    const savedPageSize = localStorage.getItem('predict_page_size');
    return savedPageSize ? parseInt(savedPageSize) : 100;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentAiType, setCurrentAiType] = useState<AiTypeConfig | null>(null);
  const [isDrawResultModalVisible, setIsDrawResultModalVisible] = useState(false);
  const [currentDrawResults, setCurrentDrawResults] = useState<DrawResult[] | null>(null);

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: size,
      };

      const response = await axiosServices.get('/client/lot/get_ai_guess_list', {
        params
      });
      setData(response.data.data.data);
      setTotal(response.data.data.total);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize]);

  // 当pageSize变化时保存到localStorage
  useEffect(() => {
    localStorage.setItem('predict_page_size', pageSize.toString());
  }, [pageSize]);

  // 添加刷新函数
  const handleRefresh = () => {
    setCurrentPage(1); // 重置页码为1
    fetchData(1, pageSize); // 刷新数据
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
      toast.error('暂无开奖结果');
      return;
    }
    setCurrentDrawResults(drawResults);
    setIsDrawResultModalVisible(true);
  };

  const handleDrawResultModalClose = () => {
    setIsDrawResultModalVisible(false);
  };

  const getStatusTag = (status: string) => {
    switch(status) {
      case 'created':
        return <Tag color="blue">待预测</Tag>;
      case 'drawed':
        return <Tag color="cyan">已开奖</Tag>;
      case 'executing':
        return <Tag color="processing">执行中</Tag>;
      case 'finished':
        return <Tag color="green">已完成</Tag>;
      case 'failed':
        return <Tag color="red">失败</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  const formatGuessResult = (result: GuessResult | null): string => {
    if (!result) return "暂无结果";
    return `${result.top_1_number}${result.top_2_number}${result.top_3_number}${result.top_4_number}${result.top_5_number}`;
  };

  // 获取预测结果和开奖结果的共同数字
  const getCommonDigits = (prediction: string, drawNumber: string): number[] => {
    const commonIndexes: number[] = [];
    
    for (let i = 0; i < prediction.length; i++) {
      if (drawNumber.includes(prediction[i])) {
        commonIndexes.push(i);
      }
    }
    
    return commonIndexes;
  };

  // 计算预测结果和开奖结果的重合数字数量
  const countCommonDigits = (prediction: string, drawResults: DrawResult[] | null): number => {
    if (!drawResults || drawResults.length === 0 || !prediction || prediction === "暂无结果") return 0;
    
    let maxCommonCount = 0;
    
    for (const drawResult of drawResults) {
      const fullNumber = drawResult.full_number;
      let commonCount = 0;
      
      for (let i = 0; i < prediction.length; i++) {
        if (fullNumber.includes(prediction[i])) {
          commonCount++;
        }
      }
      
      if (commonCount > maxCommonCount) {
        maxCommonCount = commonCount;
      }
    }
    
    return maxCommonCount;
  };

  // 渲染带有高亮的预测结果
  const renderHighlightedPrediction = (prediction: string, drawResults: DrawResult[] | null) => {
    if (!drawResults || drawResults.length === 0 || prediction === "暂无结果") {
      return prediction;
    }
    
    // 找出最匹配的开奖结果
    let bestMatchDrawResult = drawResults[0];
    let maxCommonCount = 0;
    
    for (const drawResult of drawResults) {
      const commonIndexes = getCommonDigits(prediction, drawResult.full_number);
      if (commonIndexes.length > maxCommonCount) {
        maxCommonCount = commonIndexes.length;
        bestMatchDrawResult = drawResult;
      }
    }
    
    const commonIndexes = getCommonDigits(prediction, bestMatchDrawResult.full_number);
    
    return (
      <span>
        {prediction.split('').map((digit, index) => (
          <span 
            key={index} 
            className={commonIndexes.includes(index) ? 'highlighted-digit' : ''}
          >
            {digit}
          </span>
        ))}
      </span>
    );
  };

  // 渲染开奖结果
  const renderDrawResult = (record: PredictItem) => {
    if (!record.ext_result || record.ext_result.length === 0) {
      return "暂无结果";
    }
    
    // 查找与预测期号匹配的开奖结果
    const matchedDrawResult = record.ext_result.find(
      result => result.draw_number === record.guess_period
    );
    
    // 如果找不到匹配的，使用第一个开奖结果
    const drawResult = matchedDrawResult || record.ext_result[0];
    const prediction = record.guess_result ? formatGuessResult(record.guess_result) : "";
    const commonIndexes = getCommonDigits(prediction, drawResult.full_number);
    
    return (
      <div>
        <span 
          style={{ cursor: 'pointer' }}
          onClick={() => {
            navigator.clipboard.writeText(drawResult.full_number);
            toast.success('已复制到剪贴板');
          }}
        >
          {drawResult.full_number.split('').map((digit, index) => {
            const isCommon = prediction.includes(digit);
            return (
              <span 
                key={index} 
                className={isCommon ? 'highlighted-digit' : ''}
              >
                {digit}
              </span>
            );
          })}
        </span>
      </div>
    );
  };

  const columns = [
    {
      title: "期号",
      dataIndex: "guess_period",
      key: "guess_period",
      render: (text: string) => (
        <span 
          style={{ cursor: 'pointer' }}
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast.success('已复制到剪贴板');
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
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(resultText);
              toast.success('已复制到剪贴板');
            }}
          >
            {renderHighlightedPrediction(resultText, record.ext_result)}
          </span>
        );
      },
    },
    {
      title: "开奖结果",
      key: "draw_result",
      render: (record: PredictItem) => renderDrawResult(record),
    },
    {
      title: "重合数字",
      key: "common_digits",
      render: (record: PredictItem) => {
        const prediction = record.guess_result ? formatGuessResult(record.guess_result) : "";
        const commonCount = countCommonDigits(prediction, record.ext_result);
        
        if (commonCount === 0 && (!record.ext_result || record.ext_result.length === 0)) {
          return "-";
        }
        
        return (
          <Badge 
            count={commonCount} 
            style={{ 
              backgroundColor: commonCount >= 3 ? '#52c41a' : (commonCount >= 1 ? '#1890ff' : '#f5222d'),
              fontSize: '14px',
              fontWeight: 'bold',
              padding: '0 8px'
            }} 
          />
        );
      },
    },
    {
      title: "处理状态",
      key: "process_status",
      render: (record: PredictItem) => getStatusTag(record.draw_status),
    },
    {
      title: "中奖状态",
      key: "win_status",
      render: (record: PredictItem) => {
        if (record.draw_status !== 'finished') {
          return "-";
        }
        
        return record.is_success ? 
          <Tag color="success">
            <CheckCircleOutlined /> 中奖
          </Tag> : 
          <Tag color="error">
            <CloseCircleOutlined /> 未中奖
          </Tag>;
      },
    },
    {
      title: "预测时间",
      dataIndex: "guess_time",
      key: "guess_time",
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
    },
    {
      title: "策略类型",
      dataIndex: ["ai_type", "type"],
      key: "ai_type_type",
    },
  ];

  return (
    <MainLayout>
      <div className="predict-container">
        <div className="predict-header">
          <h1 className="predict-title">AI预测记录</h1>
          <div className="predict-controls">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </div>
        </div>

        <div className="predict-table-container">
          <Table
            loading={loading}
            columns={columns}
            dataSource={data}
            rowKey="_id"
            scroll={{ y: 'calc(100vh - 250px)' }}
            className="selectable-table"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              pageSizeOptions: ['8','10', '20', '50', '100','500','1000'],
              showTotal: (total) => `共 ${total} 条数据`,
            }}
          />
        </div>

        {/* AI类型详情模态框 */}
        <Modal
          title={
            <div>
              <InfoCircleOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
              预测策略详情
            </div>
          }
          open={isModalVisible}
          onCancel={handleModalClose}
          footer={[
            <Button key="close" onClick={handleModalClose}>
              关闭
            </Button>
          ]}
          width={800}
          className="ai-type-modal"
        >
          {currentAiType && (
            <div className="ai-type-details">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="基本信息" bordered={false}>
                    <p><strong>策略名称:</strong> {currentAiType.name}</p>
                    <p><strong>策略类型:</strong> {currentAiType.type}</p>
                    <p><strong>使用模型:</strong> {currentAiType.config.model}</p>
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
              <InfoCircleOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
              开奖结果详情
            </div>
          }
          open={isDrawResultModalVisible}
          onCancel={handleDrawResultModalClose}
          footer={[
            <Button key="close" onClick={handleDrawResultModalClose}>
              关闭
            </Button>
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
                    render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
                  }
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