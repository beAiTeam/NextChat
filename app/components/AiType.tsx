"use client";

import { Table, Button, Card, Row, Col, Tag, Modal, Typography, Divider, Tooltip, Space, Form, Input, Select } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import './AiType.scss';
import toast from 'react-hot-toast';
import MainLayout from './Layout';
import { ReloadOutlined, InfoCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { safeLocalStorage } from "../utils";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 枚举定义
enum LotAiGuessModel {
  Gpt4O = "gpt-4o",
  Gpt4OMini = "gpt-4o-mini",
  O3Mini = "o3-mini",
}

enum LotAiGuessType {
  Ai5_Normal = "ai_5_normal",
}

interface AiTypeConfig {
  _id: string;
  created_at: string;
  updated_at: string;
  name: string;
  type: string;
  config: {
    prompt: string;
    model: string;
  }
}

interface UpdateAiTypeRequest {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  config?: {
    prompt: string;
    model: string;
  } | null;
}

const AiType = () => {
  const localStorage = safeLocalStorage();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    // 尝试从localStorage读取保存的pageSize
    const savedPageSize = localStorage.getItem('ai_type_page_size');
    return savedPageSize ? parseInt(savedPageSize) : 10;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AiTypeConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentAiType, setCurrentAiType] = useState<AiTypeConfig | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [editingAiType, setEditingAiType] = useState<AiTypeConfig | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: size,
      };

      const response = await axiosServices.get('/client/lot/get_ai_type', {
        params
      });
      
      // 根据新的接口返回结构调整数据处理
      if (response.data && response.data.code === 1 && Array.isArray(response.data.data)) {
        setData(response.data.data);
        setTotal(response.data.data.length); // 如果接口没有返回总数，使用数组长度
      } else {
        console.error('接口返回数据格式不符合预期:', response.data);
        toast.error('获取数据失败: 接口返回数据格式不符合预期');
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize]);

  // 当pageSize变化时保存到localStorage
  useEffect(() => {
    localStorage.setItem('ai_type_page_size', pageSize.toString());
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

  // 显示创建/编辑表单模态框
  const showFormModal = (aiType?: AiTypeConfig) => {
    setEditingAiType(aiType || null);
    form.resetFields();
    
    if (aiType) {
      // 编辑现有AI类型
      form.setFieldsValue({
        name: aiType.name,
        type: aiType.type,
        model: aiType.config.model,
        prompt: aiType.config.prompt,
      });
    }
    
    setIsFormModalVisible(true);
  };

  // 关闭表单模态框
  const handleFormModalClose = () => {
    setIsFormModalVisible(false);
    form.resetFields();
  };

  // 提交表单
  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      const requestData: UpdateAiTypeRequest = {
        name: values.name,
        type: values.type,
        config: {
          prompt: values.prompt,
          model: values.model,
        }
      };
      
      // 如果是编辑模式，添加ID
      if (editingAiType) {
        requestData.id = editingAiType._id;
      }
      
      const response = await axiosServices.post('/client/lot/update_ai_type', requestData);
      
      if (response.data && response.data.code === 1) {
        toast.success(editingAiType ? '更新成功' : '创建成功');
        handleFormModalClose();
        handleRefresh(); // 刷新数据
      } else {
        toast.error(`${editingAiType ? '更新' : '创建'}失败: ${response.data.msg || '未知错误'}`);
      }
    } catch (error) {
      console.error(`${editingAiType ? '更新' : '创建'}失败:`, error);
      toast.error(`${editingAiType ? '更新' : '创建'}失败`);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "_id",
      key: "_id",
      width: 220,
      ellipsis: true,
    },
    {
      title: "策略名称",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: AiTypeConfig) => (
        <span 
          className="clickable-text"
          onClick={() => showAiTypeModal(record)}
        >
          {text}
        </span>
      ),
    },
    {
      title: "策略类型",
      dataIndex: "type",
      key: "type",
    },
    {
      title: "使用模型",
      dataIndex: ["config", "model"],
      key: "model",
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: AiTypeConfig) => (
        <Button 
          type="text" 
          icon={<EditOutlined />} 
          onClick={() => showFormModal(record)}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="ai-type-container">
        <div className="ai-type-header">
          <h1 className="ai-type-title">AI预测策略</h1>
          <div className="ai-type-controls">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showFormModal()}
            >
              新建策略
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </div>
        </div>

        <div className="ai-type-table-container">
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
              pageSizeOptions: ['10', '20', '50', '100'],
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
          className="ai-type-detail-modal"
        >
          {currentAiType && (
            <div className="ai-type-details">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="基本信息" bordered={false}>
                    <p><strong>ID:</strong> {currentAiType._id}</p>
                    <p><strong>策略名称:</strong> {currentAiType.name}</p>
                    <p><strong>策略类型:</strong> {currentAiType.type}</p>
                    <p><strong>使用模型:</strong> {currentAiType.config.model}</p>
                    <p><strong>创建时间:</strong> {new Date(currentAiType.created_at).toLocaleString()}</p>
                    <p><strong>更新时间:</strong> {new Date(currentAiType.updated_at).toLocaleString()}</p>
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

        {/* 创建/编辑AI类型表单模态框 */}
        <Modal
          title={
            <div>
              {editingAiType ? (
                <>
                  <EditOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  编辑预测策略
                </>
              ) : (
                <>
                  <PlusOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  新建预测策略
                </>
              )}
            </div>
          }
          open={isFormModalVisible}
          onCancel={handleFormModalClose}
          footer={[
            <Button key="cancel" onClick={handleFormModalClose}>
              取消
            </Button>,
            <Button 
              key="submit" 
              type="primary" 
              loading={submitting}
              onClick={handleFormSubmit}
            >
              {editingAiType ? '更新' : '创建'}
            </Button>
          ]}
          width={800}
          className="ai-type-form-modal"
        >
          <Form
            form={form}
            layout="vertical"
            name="aiTypeForm"
            initialValues={{
              type: LotAiGuessType.Ai5_Normal,
              model: LotAiGuessModel.Gpt4OMini,
            }}
          >
            <Form.Item
              name="name"
              label="策略名称"
              rules={[{ required: true, message: '请输入策略名称' }]}
            >
              <Input placeholder="请输入策略名称" />
            </Form.Item>
            
            <Form.Item
              name="type"
              label="策略类型"
              rules={[{ required: true, message: '请选择策略类型' }]}
            >
              <Select placeholder="请选择策略类型">
                <Option value={LotAiGuessType.Ai5_Normal}>AI 5位数预测</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              name="model"
              label="使用模型"
              rules={[{ required: true, message: '请选择使用模型' }]}
            >
              <Select placeholder="请选择使用模型">
                <Option value={LotAiGuessModel.Gpt4O}>GPT-4o</Option>
                <Option value={LotAiGuessModel.Gpt4OMini}>GPT-4o Mini</Option>
                <Option value={LotAiGuessModel.O3Mini}>O3 Mini</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              name="prompt"
              label="Prompt 内容"
              rules={[{ required: true, message: '请输入Prompt内容' }]}
            >
              <TextArea 
                placeholder="请输入Prompt内容" 
                autoSize={{ minRows: 10, maxRows: 20 }}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
};

export default AiType; 