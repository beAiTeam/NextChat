"use client";

import { CopyOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Form, Input, Modal, Select, Table, message } from "antd";
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useEffect, useState } from "react";
import { AiLogItem, LotAiGuessType } from "../types/ai";
import { safeLocalStorage } from "../utils";
import axiosServices from "../utils/my-axios";
import MainLayout from './Layout';

dayjs.extend(customParseFormat);

const { Option } = Select;

interface LogFormValues {
  ai_type_id?: string;
  ai_type?: string;
  guess_period?: string;
  guess_time?: number | dayjs.Dayjs;
}

interface DetailModalProps {
  visible: boolean;
  data: any;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ visible, data, onClose }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('复制成功');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const formatAllPrompt = (allPrompt: any): string => {
    if (typeof allPrompt === 'string') {
      return allPrompt;
    }
    if (typeof allPrompt === 'object') {
      return JSON.stringify(allPrompt, null, 2);
    }
    return '';
  };

  const formatResult = (result: any): string => {
    if (!result) return '';
    if (typeof result === 'string') {
      return result;
    }
    if (typeof result === 'object') {
      if (result.top_1_number !== undefined) {
        const numbers = [
          result.top_1_number,
          result.top_2_number,
          result.top_3_number,
          result.top_4_number,
          result.top_5_number
        ].filter(Boolean).join('');
        return numbers;
      }
      return JSON.stringify(result, null, 2);
    }
    return '';
  };

  return (
    <Modal
      title="预测详情"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'text' }}>
        <h4>提示词：
          <Button
              icon={<CopyOutlined />}
              type="link"
              onClick={() => copyToClipboard(formatAllPrompt(data?.all_prompt))}
          >
            复制
          </Button>
        </h4>
        <div style={{ background: '#f5f5f5', padding: 16, marginBottom: 16, maxHeight: 300, overflow: 'auto', userSelect: 'text' }}>
          {formatAllPrompt(data?.all_prompt)}
        </div>
      <h4>AI策略完整配置：
          <Button
            icon={<CopyOutlined />}
            type="link"
            onClick={() => copyToClipboard(JSON.stringify(data?.ai_type || {}, null, 2))}
          >
            复制
          </Button>
        </h4>
        <div style={{ background: '#f5f5f5', padding: 16, maxHeight: 300, overflow: 'auto', userSelect: 'text' }}>
          <pre>{JSON.stringify(data?.ai_type || {}, null, 2)}</pre>
        </div>

        <h4>AI策略信息：</h4>
        <div style={{ background: '#f5f5f5', padding: 16, marginBottom: 16, userSelect: 'text' }}>
          <p><strong>策略名称：</strong>{data?.ai_type?.name}</p>
          <p><strong>策略类型：</strong>{data?.ai_type?.type}</p>
          <p><strong>AI模型：</strong>{data?.ai_type?.config?.model}</p>
          <p><strong>温度：</strong>{data?.ai_type?.config?.temperature}</p>
          <p><strong>最大Token：</strong>{data?.ai_type?.config?.max_tokens}</p>
          <p><strong>冷期：</strong>{data?.ai_type?.config?.cold_period}</p>
          <p><strong>热期：</strong>{data?.ai_type?.config?.hot_period}</p>
          <p><strong>缺失期：</strong>{data?.ai_type?.config?.missing_period}</p>
          <p><strong>获取期：</strong>{data?.ai_type?.config?.get_period}</p>
        </div>

        <h4>预测结果：
          <Button
            icon={<CopyOutlined />}
            type="link"
            onClick={() => copyToClipboard(formatResult(data?.result))}
          >
            复制
          </Button>
        </h4>
        <div style={{ background: '#f5f5f5', padding: 16, marginBottom: 16, maxHeight: 100, overflow: 'auto', userSelect: 'text' }}>
          {formatResult(data?.result)}
        </div>
      </div>
    </Modal>
  );
};

const Log = () => {
  const localStorage = safeLocalStorage();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const savedPageSize = localStorage.getItem('ai_log_page_size');
    return savedPageSize ? parseInt(savedPageSize) : 10;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AiLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [form] = Form.useForm<LogFormValues>();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('复制成功');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const fetchData = async (page: number, size: number, filters?: any) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: size,
        ...filters
      };

      // 移除空值并处理日期
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
        // 转换日期为时间戳
        if (key === 'guess_time' && dayjs.isDayjs(params[key])) {
          params[key] = Math.floor(params[key].valueOf() / 1000);
        }
      });

      const response = await axiosServices.get('/client/lot/get_ai_log_list', {
        params
      });

      if (response.data && response.data.code === 1) {
        setData(response.data.data.data || []);
        setTotal(response.data.data.total || 0);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const values = form.getFieldsValue();
    fetchData(currentPage, pageSize, values);
  }, [currentPage, pageSize]);

  useEffect(() => {
    localStorage.setItem('ai_log_page_size', pageSize.toString());
  }, [pageSize]);

  const handleRefresh = () => {
    setCurrentPage(1);
    const filters = form.getFieldsValue(true);
    fetchData(1, pageSize, filters);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    const values = form.getFieldsValue();
    fetchData(1, pageSize, values);
  };

  const handleReset = () => {
    form.resetFields();
    setCurrentPage(1);
    fetchData(1, pageSize, {});
  };

  const showDetail = (record: any) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  const renderColumnWithCopy = (value: any, render?: (value: any) => React.ReactNode) => {
    const displayValue = render ? render(value) : value;
    if (!value) return null;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(String(value));
        }}
        style={{
          cursor: 'pointer',
          transition: 'background 0.3s',
          padding: '4px 8px',
          margin: '-4px -8px',
          borderRadius: '4px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {displayValue}
      </div>
    );
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "_id",
      key: "_id",
      width: 220,
      ellipsis: true,
      render: (text: string) => renderColumnWithCopy(text)
    },
    {
      title: "AI模型",
      dataIndex: ["ai_type", "config", "model"],
      key: "ai_model",
      width: 120,
      render: (text: string) => renderColumnWithCopy(text)
    },
    {
      title: "策略名称",
      dataIndex: ["ai_type", "name"],
      key: "ai_type_name",
      render: (text: string) => renderColumnWithCopy(text)
    },
    {
      title: "策略类型",
      dataIndex: ["ai_type", "type"],
      key: "ai_type",
      render: (text: string) => renderColumnWithCopy(text)
    },
    {
      title: "预测期数",
      dataIndex: "guess_period",
      key: "guess_period",
      render: (text: string) => renderColumnWithCopy(text)
    },
    {
      title: "预测时间",
      dataIndex: "guess_time",
      key: "guess_time",
      render: (text: number) => renderColumnWithCopy(text, (value) => dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss'))
    },
    {
      title: "预测结果",
      dataIndex: "result",
      key: "result",
      width: 200,
      ellipsis: true,
      render: (result: any) => {
        if (!result) return null;
        if (typeof result === 'string') {
          return renderColumnWithCopy(result);
        }
        // 如果是对象格式，将其转换为字符串显示
        if (typeof result === 'object') {
          const numbers = [
            result.top_1_number,
            result.top_2_number,
            result.top_3_number,
            result.top_4_number,
            result.top_5_number
          ].filter(Boolean).join('');
          return renderColumnWithCopy(numbers);
        }
        return null;
      }
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text: string) => renderColumnWithCopy(text, (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'))
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => showDetail(record)}
        >
          查看详情
        </Button>
      ),
    }
  ];

  return (
    <MainLayout>
      <div className="ai-log-container" style={{ userSelect: 'text' }}>
        <div className="ai-log-header">
          <h1 className="ai-log-title">AI预测日志</h1>

        </div>

        <Card className="ai-log-search" style={{ marginBottom: 16 ,marginTop:20}}>
          <Form
            form={form}
            layout="inline"
            onFinish={handleSearch}
            style={{gap:10}}
          >
            <Form.Item name="ai_type_id" label="策略ID">
              <Input placeholder="请输入策略ID" style={{ width: 350, backgroundColor: 'white' }} />
            </Form.Item>

            <Form.Item name="ai_type" label="策略类型">
              <Select
                placeholder="请选择策略类型"
                style={{ width: 200, backgroundColor: 'white' }}
                allowClear
              >
                {/* 遍历LotAiGuessType */}
                {Object.values(LotAiGuessType).map((type) => (
                  <Option key={type} value={type}>{type}</Option>
                ))}
                {/* <Option value={LotAiGuessType.Ai5_Normal}>AI 5位数预测</Option>
                <Option value={LotAiGuessType.Ai5_Plus}>AI 5位数Plus预测</Option>
                <Option value={LotAiGuessType.Ai5_Gemini}>AI 5位数Gemini预测</Option>
                <Option value={LotAiGuessType.Ai5_Gemini_Plus}>AI 5位数Gemini Plus预测</Option>
                <Option value={LotAiGuessType.Zlzdm}>智能指点迷</Option>
                <Option value={LotAiGuessType.Ylzhb}>预料之后必</Option> */}
              </Select>
            </Form.Item>

            <Form.Item name="guess_period" label="预测期数">
              <Input placeholder="请输入预测期数" style={{ width: 300, backgroundColor: 'white' }} />
            </Form.Item>

            <Form.Item name="guess_time" label="预测时间">
              <DatePicker
                showTime
                style={{ width: 200, backgroundColor: 'white' }}
                format="YYYY-MM-DD HH:mm:ss"
                onChange={(date) => {
                  if (date) {
                    form.setFields([{
                      name: 'guess_time',
                      value: date
                    }]);
                  }
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button style={{ marginLeft: 8 }} onClick={handleReset}>
                重置
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="ai-log-table-container">
          <Table
            loading={loading}
            columns={columns}
            dataSource={data}
            rowKey="_id"
            scroll={{ y: 'calc(100vh - 350px)' }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: (page: number, size: number) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total: number) => `共 ${total} 条数据`,
            }}
            onRow={() => ({
              style: {
                cursor: 'default',
                userSelect: 'text'
              }
            })}
          />
        </div>

        <DetailModal
          visible={detailModalVisible}
          data={selectedRecord}
          onClose={() => setDetailModalVisible(false)}
        />
      </div>
    </MainLayout>
  );
};

export default Log;
