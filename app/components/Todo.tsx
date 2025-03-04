"use client";

import { Table } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import './Todo.scss';

interface LotteryItem {
  _id: string;
  created_at: string;
  updated_at: string;
  draw_number: string;
  draw_time: number;
  number_1: number;
  number_2: number;
  number_3: number;
  number_4: number;
  number_5: number;
  full_number: string;
  sum_value: number;
  odd_count: number;
  even_count: number;
}

const Todo = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LotteryItem[]>([]);
  const [total, setTotal] = useState(0);

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const response = await axiosServices.get('/public/lot/get_lottery_data_by_page', {
        params: {
          page,
          page_size: size
        }
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

  const columns = [
    {
      title: "序号",
      dataIndex: "draw_number",
      key: "draw_number",
    },
    {
      title: "Number",
      key: "full_number",
      render: (record: LotteryItem) => (
        <span>
          {record.number_1} {record.number_2} {record.number_3} {record.number_4} {record.number_5}
        </span>
      ),
    },
    {
      title: "和值",
      dataIndex: "sum_value",
      key: "sum_value",
    },
    {
      title: "单双比",
      key: "odd_even",
      render: (record: LotteryItem) => (
        <span>{record.odd_count}单{record.even_count}双</span>
      ),
    },
    {
      title: "时间",
      dataIndex: "draw_time",
      key: "draw_time",
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
    },
  ];

  return (
    <div className="lottery-container">
      <h1 className="lottery-title">Lottery记录</h1>
      <div className="lottery-table-container">
        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="_id"
          scroll={{ y: 'calc(100vh - 250px)' }}
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
    </div>
  );
};

export default Todo; 