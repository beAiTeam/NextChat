"use client";

import { Table, Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import { useState, useEffect } from 'react';
import axiosServices from '../utils/my-axios';
import MainLayout from '../components/Layout';
import { Path } from '../constant';
import { useRouter } from 'next/navigation';
import { safeLocalStorage } from "../utils";

interface PromptItem {
  _id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const PromptPage = () => {
  const [data, setData] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [form] = Form.useForm();
  const router = useRouter();

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const response = await axiosServices.get('/client/prompt/get_prompt_by_page', {
        params: {
          page,
          page_size: size,
        }
      });
      setData(response.data.data.data);
      setTotal(response.data.data.total);
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize]);

  const handleEdit = (record: PromptItem) => {
    setEditingPrompt(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleAdd = () => {
    setEditingPrompt(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('form values:', values);
      
      const response = await axiosServices.post('/client/prompt/update_prompt', null, {
        params: editingPrompt 
          ? {
              id: editingPrompt._id,
              title: values.title,
              content: values.content
            }
          : {
              title: values.title,
              content: values.content
            }
      });
      
      message.success(editingPrompt ? '更新成功' : '新建成功');
      setIsModalVisible(false);
      form.resetFields();
      fetchData(currentPage, pageSize);
    } catch (error) {
      console.error(editingPrompt ? '更新失败:' : '新建失败:', error);
      message.error(editingPrompt ? '更新失败' : '新建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axiosServices.delete(`/client/prompt/${id}`);
      message.success('删除成功');
      fetchData(currentPage, pageSize);
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleUseStrategy = (record: PromptItem) => {
    const storage = safeLocalStorage();
    storage.setItem('selectedPromptStrategy', JSON.stringify({
      title: record.title,
      content: record.content,
      timestamp: Date.now()
    }));
    router.push('/chat');
    message.success('已应用该策略');
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PromptItem) => (
        <>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => handleUseStrategy(record)}>
            使用此策略
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Prompt管理</h1>
          <Button type="primary" onClick={handleAdd}>
            新建Prompt
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条数据`,
          }}
        />

        <Modal
          title={editingPrompt ? "编辑Prompt" : "新建Prompt"}
          open={isModalVisible}
          onOk={handleModalOk}
          onCancel={() => setIsModalVisible(false)}
          width={800}
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="content"
              label="内容"
              rules={[{ required: true, message: '请输入内容' }]}
            >
              <Input.TextArea rows={6} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
};

export default PromptPage; 