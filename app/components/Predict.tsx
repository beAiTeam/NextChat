"use client";

import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Modal, Row, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { safeLocalStorage } from "../utils";
import axiosServices from "../utils/my-axios";
import MainLayout from './Layout';
import './Predict.scss';

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
        return <Tag color="cyan">已开</Tag>;
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
  const renderHighlightedPrediction = (prediction: string, drawResults: DrawResult[] | null, guessPeriod?: string) => {
    if (!drawResults || drawResults.length === 0 || prediction === "暂无结果") {
      return prediction;
    }
    
    return (
      <span>
        {prediction.split('').map((digit, index) => {
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
              className={shouldHighlight 
                ? (isFirstDigit ? 'highlighted-digit-gold' : 'highlighted-digit') 
                : 'digit'}
            >
              {digit}
            </span>
          );
        })}
      </span>
    );
  };

  // 渲染开奖结果
  const renderDrawResult = (record: PredictItem) => {
   
    // 当ext_result长度不等于3时，显示等待开奖结果
    if (!record.ext_result || record.ext_result.length === 0 ) {
      return "等待开奖结果";
    }
    
    const prediction = record.guess_result ? formatGuessResult(record.guess_result) : "";
    if (prediction === "暂无结果" || prediction.length === 0) {
      return prediction;
    }

    // 获取预测结果的第一个数字和后4位数字
    const firstDigitOfPrediction = prediction[0];
    const lastFourDigits = prediction.slice(1);
    
    return (
      <div>
        {record.ext_result.map((drawResult, resultIndex) => {
          // 检查这组开奖结果是否匹配预测结果
          const fullNumberDigits = drawResult.full_number.split('');
          const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
          const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit => 
            fullNumberDigits.includes(digit)
          );
          const isMatched = isFirstDigitMatched && isAnyLastFourDigitsMatched;

          return (
            <div 
              key={resultIndex} 
              style={{ 
                marginBottom: resultIndex < record.ext_result!.length - 1 ? '8px' : '0',
                padding: '4px 8px',
                backgroundColor: isMatched ? '#e6f7ff' : 'transparent',
                borderRadius: '4px'
              }}
            >
              <span style={{ marginRight: '8px', fontSize: '12px', color: '#888' }}>
                {drawResult.draw_number}:
              </span>
              <span 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText(drawResult.full_number);
                  toast.success('已复制到剪贴板');
                }}
              >
                {drawResult.full_number.split('').map((digit, index) => {
                  // 判断开奖结果中的数字是否在预测结果中出现
                  const isCommon = prediction.includes(digit);
                  // 如果预测结果的第一位与当前数字匹配，则标红色
                  const isFirstDigitMatch = prediction.length > 0 && digit === prediction[0];
                  
                  return (
                    <span 
                      key={index} 
                      className={isCommon 
                        ? (isFirstDigitMatch ? 'highlighted-digit-gold' : 'highlighted-digit') 
                        : 'digit'}
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

  // 添加一个新函数来检查当前第一位数字是否匹配
  const checkFirstDigitMatch = (record: PredictItem) => {
    // 如果没有预测结果或开奖结果，则无法判断
    if (!record.guess_result || !record.ext_result || record.ext_result.length === 0) {
      return false;
    }

    // 获取预测结果
    const prediction = formatGuessResult(record.guess_result);
    if (prediction === "暂无结果" || prediction.length === 0) {
      return false;
    }
    
    // 获取预测结果的第一个数字
    const firstDigitOfPrediction = prediction[0];
    
    // 获取预测结果的所有数字
    const predictionDigits = prediction.split('');
    
    // 获取预测结果的后4位数字
    const lastFourDigits = prediction.slice(1);

    // 只检查期号相同的那组开奖结果
    const matchedDrawResult = record.ext_result.find(drawResult => 
      drawResult.draw_number === record.guess_period
    );
    
    // 如果找不到匹配的期号，返回false
    if (!matchedDrawResult) {
      return false;
    }
    
    // 将开奖结果拆分成单个数字
    const fullNumberDigits = matchedDrawResult.full_number.split('');
    
    // 条件1：检查预测结果的第一个数字是否出现在匹配期号的开奖结果中的任意位置
    const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
    
    // 条件2：检查预测结果后4位中的任意一位是否在该期开奖结果中出现
    const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit => 
      fullNumberDigits.includes(digit)
    );
    
    // 同时满足两个条件才返回true
    return isFirstDigitMatched && isAnyLastFourDigitsMatched;
  };

  // 添加新方法检查三期内是否有匹配
  const checkThreePeriodsMatch = (record: PredictItem) => {
    if (!record.guess_result || !record.ext_result || record.ext_result.length === 0) {
      return { status: 'waiting', message: "等待开奖结果" };
    }

    const prediction = formatGuessResult(record.guess_result);
    if (prediction === "暂无结果" || prediction.length === 0) {
      return { status: 'waiting', message: "等待预测结果" };
    }

    const firstDigitOfPrediction = prediction[0];
    const lastFourDigits = prediction.slice(1);

    const hasMatch = record.ext_result.some(drawResult => {
      const fullNumberDigits = drawResult.full_number.split('');
      const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
      const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit => 
        fullNumberDigits.includes(digit)
      );
      return isFirstDigitMatched && isAnyLastFourDigitsMatched;
    });

    return {
      status: 'finished',
      isMatch: hasMatch
    };
  };

  const handleExportExcel = () => {
    // 准备Excel数据
    const exportData = data.map(item => {
      // 获取匹配信息
      let matchInfo = '';
      if (item.ext_result && item.ext_result.length > 0 && item.guess_result) {
        const prediction = formatGuessResult(item.guess_result);
        const firstDigitOfPrediction = prediction[0];
        const lastFourDigits = prediction.slice(1);

        // 查找匹配的结果
        const matchedIndex = item.ext_result.findIndex(drawResult => {
          const fullNumberDigits = drawResult.full_number.split('');
          const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
          const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit => 
            fullNumberDigits.includes(digit)
          );
          return isFirstDigitMatched && isAnyLastFourDigitsMatched;
        });

        if (matchedIndex !== -1) {
          matchInfo = `，第${item.guess_period}期中了，开在第${matchedIndex + 1}期中`;
        }
      }

      return {
        '期号': item.guess_period,
        '预测策略': item.ai_type.name,
        '预测结果': item.guess_result ? formatGuessResult(item.guess_result) : '暂无结果',
        '正式结果': item.ext_result ? item.ext_result.map(r => r.full_number).join(', ') + matchInfo : '等待开奖结果',
        '当期状态': checkFirstDigitMatch(item) ? '中' : '未中',
        '状态': item.is_success ? '中' : '未中',
        '预测时间': new Date(item.guess_time * 1000).toLocaleString()
      };
    });

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "预测数据");

    // 导出Excel文件
    XLSX.writeFile(wb, "predict_data.xlsx");
    toast.success('导出成功！');
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
        if (!record.guess_result || !record.ext_result || record.ext_result.length === 0) {
          return "等待开奖结果";
        }
        
        // 检查是否存在匹配的期号
        const matchedDrawResult = record.ext_result.find(drawResult => 
          drawResult.draw_number === record.guess_period
        );
        
        // 如果找不到匹配的期号，返回等待开奖结果
        if (!matchedDrawResult) {
          return "等待开奖结果";
        }
        
        return checkFirstDigitMatch(record) ? 
          <Tag color="success">
            <CheckCircleOutlined /> 中
          </Tag> : 
          <Tag color="error">
            <CloseCircleOutlined /> 未中
          </Tag>;
      },
    },
    {
      title: "状态",
      key: "win_status",
      render: (record: PredictItem) => {
        const matchResult = checkThreePeriodsMatch(record);
        
        if (matchResult.status === 'waiting') {
          return matchResult.message;
        }

        return matchResult.isMatch ? 
          <Tag color="success">
            <CheckCircleOutlined /> 中
          </Tag> : 
          <Tag color="error">
            <CloseCircleOutlined /> 未中
          </Tag>;
      },
    },
    {
      title: "预测时间",
      dataIndex: "guess_time",
      key: "guess_time",
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
    },
  ];

  return (
    <MainLayout>
      <div className="predict-container">
        <div className="predict-header">
          <h1 className="predict-title">AI预测记录</h1>
          <div className="predict-controls">
            <Button 
              type="primary" 
              onClick={handleExportExcel}
              className="export-button"
            >
              导出Excel
            </Button>
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
              pageSizeOptions: ['8','10', '20', '50', '100','200','500','1000'],
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