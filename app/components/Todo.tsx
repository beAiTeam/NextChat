"use client";

import { Table, DatePicker, Button, Input, Card, Row, Col, Statistic, Modal } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import './Todo.scss';
import type { Dayjs } from 'dayjs';
import type { RangePickerProps } from 'antd/es/date-picker';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import MainLayout from './Layout';

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

interface AnalysisData {
  total_periods: number;
  analysis_time: string;
  positions: {
    [key: string]: {
      statistics: Array<{ number: number; count: number; frequency: number }>;
      hot_numbers: Array<{ number: number; count: number; frequency: number }>;
      cold_numbers: Array<{ number: number; count: number; frequency: number }>;
    };
  };
  overall_statistics: Array<{ number: number; total_count: number; overall_frequency: number }>;
  global_hot_numbers: Array<{ number: number; total_count: number; overall_frequency: number }>;
  global_cold_numbers: Array<{ number: number; total_count: number; overall_frequency: number }>;
}

const { RangePicker } = DatePicker;

const Todo = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LotteryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [lastNPeriods, setLastNPeriods] = useState(100);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [isAnalysisModalVisible, setIsAnalysisModalVisible] = useState(false);

  const formatAnalysisDataToText = (data: AnalysisData): string => {
    let text = `分析报告\n`;
    text += `总体统计：\n`;
    text += `分析期数：${data.total_periods}\n`;
    text += `分析时间：${data.analysis_time}\n\n`;

    // 位置统计
    Object.entries(data.positions).forEach(([position, posData]) => {
      text += `位置${position.split('_')[1]}统计：\n`;
      text += `热门号码：\n`;
      posData.hot_numbers.slice(0, 5).forEach(item => {
        text += `  号码 ${item.number}: ${item.count}次 (${item.frequency}%)\n`;
      });
      text += `冷门号码：\n`;
      posData.cold_numbers.slice(0, 5).forEach(item => {
        text += `  号码 ${item.number}: ${item.count}次 (${item.frequency}%)\n`;
      });
      text += `整体统计：\n`;
      posData.statistics.slice(0, 5).forEach(item => {
        text += `  号码 ${item.number}: ${item.count}次 (${item.frequency}%)\n`;
      });
      text += '\n';
    });

    text += `全局热门号码：\n`;
    data.global_hot_numbers.slice(0, 5).forEach(item => {
      text += `  号码 ${item.number}: ${item.total_count}次 (${item.overall_frequency}%)\n`;
    });

    text += `\n全局冷门号码：\n`;
    data.global_cold_numbers.slice(0, 5).forEach(item => {
      text += `  号码 ${item.number}: ${item.total_count}次 (${item.overall_frequency}%)\n`;
    });

    text += `\n整体统计：\n`;
    data.overall_statistics.slice(0, 5).forEach(item => {
      text += `  号码 ${item.number}: ${item.total_count}次 (${item.overall_frequency}%)\n`;
    });

    return text;
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
        params.lottery_start_time = Math.floor(timeRange[0].valueOf()/1000);
        params.lottery_end_time = Math.floor(timeRange[1].valueOf()/1000);
      }

      const response = await axiosServices.get('/client/lot/get_lottery_data_by_page', {
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

  const fetchAnalysisData = async (periods: number) => {
    setAnalysisLoading(true);
    try {
      const response = await axiosServices.get('/client/lot/get_lottery_analyze_all_numbers', {
        params: { last_n_periods: periods }
      });
      setAnalysisData(response.data.data);
    } catch (error) {
      console.error('获取分析数据失败:', error);
      toast.error('获取分析数据失败');
    } finally {
      setAnalysisLoading(false);
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

  const showAnalysisModal = () => {
    setIsAnalysisModalVisible(true);
    fetchAnalysisData(lastNPeriods);
  };

  const handleAnalysisModalCancel = () => {
    setIsAnalysisModalVisible(false);
  };

  const handleExportExcel = () => {
    // 准备Excel数据
    const exportData = data.map(item => ({
      '序号': item.draw_number,
      '号码': item.full_number || `${item.number_1}${item.number_2}${item.number_3}${item.number_4}${item.number_5}`,
      '和值': item.sum_value,
      '单双比': `${item.odd_count}单${item.even_count}双`,
      '时间': new Date(item.draw_time * 1000).toLocaleString()
    }));

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "数据");

    // 导出Excel文件
    XLSX.writeFile(wb, "data.xlsx");
    toast.success('导出成功！');
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
      render: (record: LotteryItem) => {
        const numbers = record.full_number || `${record.number_1}${record.number_2}${record.number_3}${record.number_4}${record.number_5}`;
        return (
          <span 
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(numbers);
              toast.success('已复制到剪贴板');
            }}
          >
            {numbers}
          </span>
        );
      },
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
    <MainLayout>
      <div className="lottery-container">
        <div className="lottery-header">
          <h1 className="lottery-title">Lottery记录</h1>
          <div className="lottery-controls">
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              onChange={handleTimeRangeChange}
              className="lottery-time-picker"
            />
            <Button 
              onClick={showAnalysisModal}
            >
              数据分析
            </Button>
            <Button 
              type="primary" 
              onClick={handleExportExcel}
              className="export-button"
            >
              导出Excel
            </Button>
          </div>
        </div>

        <Modal
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>数据分析</span>
              <div style={{ display: 'flex', gap: '8px',marginRight:30, alignItems: 'center' }}>
                <span>分析期数:</span>
                <Input
                  type="number"
                  value={lastNPeriods}
                  onChange={(e) => setLastNPeriods(Number(e.target.value))}
                  style={{ width: 120 }}
                  placeholder="分析期数"
                />
                <Button 
                  type="primary"
                  onClick={() => fetchAnalysisData(lastNPeriods)}
                  loading={analysisLoading}
                >
                  重新分析
                </Button>
                {analysisData && (
                  <Button
                    onClick={() => {
                      const text = formatAnalysisDataToText(analysisData);
                      navigator.clipboard.writeText(text);
                      toast.success('分析数据已复制到剪贴板');
                    }}
                  >
                    复制分析数据
                  </Button>
                )}
              </div>
            </div>
          }
          open={isAnalysisModalVisible}
          onCancel={handleAnalysisModalCancel}
          width={1000}
          footer={[
            <div key="footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleAnalysisModalCancel}>关闭</Button>
            </div>
          ]}
        >
          {analysisData && (
            <div className="analysis-content">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="总体统计" loading={analysisLoading}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic title="分析期数" value={analysisData.total_periods} />
                      </Col>
                      <Col span={8}>
                        <Statistic title="分析时间" value={analysisData.analysis_time} />
                      </Col>
                    </Row>
                  </Card>
                </Col>

                {/* 位置统计 */}
                {Object.entries(analysisData.positions).map(([position, data]) => (
                  <Col span={24} key={position}>
                    <Card title={`位置${position.split('_')[1]}统计`} loading={analysisLoading}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Card type="inner" title="热门号码">
                            {data.hot_numbers.slice(0, 5).map((item, index) => (
                              <div key={index}>
                                号码 {item.number}: {item.count}次 ({item.frequency}%)
                              </div>
                            ))}
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card type="inner" title="冷门号码">
                            {data.cold_numbers.slice(0, 5).map((item, index) => (
                              <div key={index}>
                                号码 {item.number}: {item.count}次 ({item.frequency}%)
                              </div>
                            ))}
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card type="inner" title="整体统计">
                            {data.statistics.slice(0, 5).map((item, index) => (
                              <div key={index}>
                                号码 {item.number}: {item.count}次 ({item.frequency}%)
                              </div>
                            ))}
                          </Card>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                ))}
                
                <Col span={8}>
                  <Card title="全局热门号码" loading={analysisLoading}>
                    {analysisData.global_hot_numbers.slice(0, 5).map((item, index) => (
                      <div key={index}>
                        号码 {item.number}: {item.total_count}次 ({item.overall_frequency}%)
                      </div>
                    ))}
                  </Card>
                </Col>
                
                <Col span={8}>
                  <Card title="全局冷门号码" loading={analysisLoading}>
                    {analysisData.global_cold_numbers.slice(0, 5).map((item, index) => (
                      <div key={index}>
                        号码 {item.number}: {item.total_count}次 ({item.overall_frequency}%)
                      </div>
                    ))}
                  </Card>
                </Col>
                
                <Col span={8}>
                  <Card title="整体统计" loading={analysisLoading}>
                    {analysisData.overall_statistics.slice(0, 5).map((item, index) => (
                      <div key={index}>
                        号码 {item.number}: {item.total_count}次 ({item.overall_frequency}%)
                      </div>
                    ))}
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </Modal>

        <div className="lottery-table-container" >
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
              pageSizeOptions: ['10', '20', '50', '100','500','1000'],
              showTotal: (total) => `共 ${total} 条数据`,
            }}
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default Todo; 