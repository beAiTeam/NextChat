"use client";

import { Table, DatePicker } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import './Todo.scss';
import type { Dayjs } from 'dayjs';
import type { RangePickerProps } from 'antd/es/date-picker';

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

const { RangePicker } = DatePicker;

const Todo = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LotteryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: size,
      };

      // 添加时间范围参数
      if (timeRange[0] && timeRange[1]) {
        params.lottery_start_time = Math.floor(timeRange[0].valueOf()/1000);
        params.lottery_end_time = Math.floor(timeRange[1].valueOf()/1000);
      }

      const response = await axiosServices.get('/public/lot/get_lottery_data_by_page', {
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
  }, [currentPage, pageSize, timeRange]);

  const handleTimeRangeChange: RangePickerProps['onChange'] = (dates) => {
    if (dates) {
      setTimeRange([dates[0], dates[1]]);
    } else {
      setTimeRange([null, null]);
    }
    setCurrentPage(1); // 重置页码
  };

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
      <div className="lottery-header">
        <h1 className="lottery-title">Lottery记录</h1>
        <RangePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          onChange={handleTimeRangeChange}
          className="lottery-time-picker"
        />
      </div>
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
            pageSizeOptions: ['10', '20', '50', '100','500','1000'],
            showTotal: (total) => `共 ${total} 条数据`,
          }}
        />
      </div>
    </div>
  );
};

export default Todo; 